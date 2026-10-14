import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {makeEnum} from "../utils/glsl_enums.js";
import {
    accumulateMoments, applyTransform, dcsTransform, finalizeMoments,
    foldAffine, locateRank, mergeMoments, percentileFromSorted, percentileRanks,
    scaleStats, transformToInputUnits,
} from "../utils/dcs_math.js";
import {inputStretchBounds, StretchEnum as InputCurveEnum} from "./inputstretch.js";

// Decorrelation stretch following marslab.imgops.render.decorrelation_stretch
// (Gillespie et al. 1986). Statistics come from the image's own bands as
// ingested (the source RGB, or Debayer's RGB composite) after Input
// Stretch, not from other effects above this one; the resulting transform
// is applied to this effect's input.
//
// marslab's output depends on the units of its input (its offset term,
// 2μ - 2μT, survives the joint min/max), so the transform is computed in the
// image's original data units u = A·x + B, x being this effect's input, and
// then re-expressed as a transform of x. See statsUnits().

const fragSources = loadFragSrcInit("decorrelation_stretch.frag", {});
const minmaxSources = loadFragSrcInit("dcs_minmax.frag", {});

// Region whose statistics drive the stretch.
const {
    enum: RegionEnum,
    options: RegionOpts
} = makeEnum(['WHOLE_IMAGE', 'CURRENT_VIEW']);

// Final stretch: JOINT is marslab's contrast_stretch=None (normalize_range:
// one min/max over all channels); PER_CHANNEL is contrast_stretch=(low, high)
// (enhance_color: per-channel percentile clip).
const {
    enum: StretchEnum,
    options: StretchOpts
} = makeEnum(['JOINT', 'PER_CHANNEL']);

// Target per-channel standard deviation: FIXED is marslab's scalar sigma;
// CLASSIC is sigma=None (each channel keeps its input standard deviation).
const {
    enum: SigmaModeEnum,
    options: SigmaModeOpts
} = makeEnum(['FIXED', 'CLASSIC']);

const TAIL_SPEC = {type: "range", min: 0, max: 50, step: 0.1};
const JOINT_ACTIVE = {key: "STRETCH", equals: StretchEnum.JOINT};
const PER_CHANNEL_ACTIVE = {key: "STRETCH", equals: StretchEnum.PER_CHANNEL};

// Live statistics: covariance and percentiles from a SAMPLE_RES² point
// sample of the region. Joint min/max is always exact (GPU reduction).
const SAMPLE_RES = 256;
// Native-resolution tile edge for the min/max reduction and export passes.
const TILE_SIZE = 1024;
// Histogram bins per channel for exact export percentile selection.
const HIST_BINS = 65536;
const FULL_REGION = Object.freeze({u0: 0, u1: 1, v0: 0, v1: 1});

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Decorrelation Stretch",
    defaultConfig: {
        REGION: RegionEnum.WHOLE_IMAGE,
        STRETCH: StretchEnum.JOINT,
        SIGMA_MODE: SigmaModeEnum.FIXED,
        SIGMA: 1.0,
        LOW: 1.0,
        HIGH: 1.0,
    },
    uiLayout: [
        {type: "select", key: "REGION", label: "Stats Region", options: RegionOpts},
        {type: "select", key: "STRETCH", label: "Stretch", options: StretchOpts},
        {
            type: "select", key: "SIGMA_MODE", label: "Sigma Mode", options: SigmaModeOpts,
            showIf: JOINT_ACTIVE
        },
        {
            type: "range", key: "SIGMA", label: "Sigma", min: 0, max: 2, step: 0.01,
            showIf: [JOINT_ACTIVE, {key: "SIGMA_MODE", equals: SigmaModeEnum.FIXED}]
        },
        {...TAIL_SPEC, key: "LOW", label: "Low Clip %", showIf: PER_CHANNEL_ACTIVE},
        {...TAIL_SPEC, key: "HIGH", label: "High Clip %", showIf: PER_CHANNEL_ACTIVE},
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const affine = getAffine(instance, instance.glState.renderer);
        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
        };
        if (!affine) {
            instance.glState.renderGL(inputTex, outputFBO, uniforms, {PASSTHROUGH: 1});
            return;
        }
        uniforms.u_m0 = {type: "vec3", value: affine.cols[0]};
        uniforms.u_m1 = {type: "vec3", value: affine.cols[1]};
        uniforms.u_m2 = {type: "vec3", value: affine.cols[2]};
        uniforms.u_b = {type: "vec3", value: affine.b};
        instance.glState.renderGL(inputTex, outputFBO, uniforms, {PASSTHROUGH: 0});
    },

    async initHook() {
        await Promise.all([fragSources.load(), minmaxSources.load()]);
    },
    cleanupHook(instance) {
        const renderer = instance.glState.renderer;
        renderer.dcsCache.delete(`${instance.id}:live`);
        renderer.dcsCache.delete(`${instance.id}:export`);
        renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
};

/**
 * Scalar map u = A·x + B from this effect's input x (Input Stretch output)
 * to original data units: PDR's scaled values (raw = scale·v + offset) for
 * float sources, 0-255 for browser images. A linear Input Stretch maps
 * [m, M] to [0, 1], so u is then the clipped data in original units; for
 * nonlinear stretch curves there is no such map and x itself is used.
 */
function statsUnits(renderer) {
    const src = renderer.source;
    const [s, o] = src.kind === "rgba8" ? [255, 0] : [src.scale, src.offset];
    const stage = renderer.getStatsStretchStage();
    if (!stage) return {A: s, B: o};
    if (Number(stage.config.stretchMode) !== InputCurveEnum.LIN) return {A: 1, B: 0};
    const [m, M] = inputStretchBounds(stage);
    return {A: s * (M - m), B: s * m + o};
}

function readConfig(config) {
    const stretch = Number(config.STRETCH);
    const sigmaMode = Number(config.SIGMA_MODE);
    return {
        region: Number(config.REGION),
        stretch,
        sigma: sigmaMode === SigmaModeEnum.CLASSIC ? null : Number(config.SIGMA),
        low: Number(config.LOW),
        high: Number(config.HIGH),
    };
}

/**
 * Folded DCS + stretch map for this effect, or null for a no-op. Statistics
 * are cached per effect and mode (live/export) and recomputed only when the
 * source, Debayer settings, or region change; the transform and bounds when
 * the effect's settings change as well.
 */
function getAffine(fx, renderer) {
    if (!renderer.source || renderer.ingressBandCount() < 3) return null;
    const cfg = readConfig(fx.config);
    const exact = renderer.dcsExport;
    const region = cfg.region === RegionEnum.CURRENT_VIEW
        ? renderer.getViewRegion() : FULL_REGION;
    const cacheId = `${fx.id}:${exact ? "export" : "live"}`;
    const stage = renderer.getStatsStretchStage();
    const units = statsUnits(renderer);
    const statsKey = JSON.stringify([
        renderer.getDebayerConfig(), region, units,
        stage && [stage.config, stage.auxiliaryCache],
    ]);
    let entry = renderer.dcsCache.get(cacheId);
    if (!entry || entry.source !== renderer.source || entry.statsKey !== statsKey) {
        const stats = exact
            ? exportStats(renderer, region)
            : liveStats(renderer, region);
        // Ingress not ready (Debayer shader loading): retry on a later frame.
        if (!stats) return null;
        entry = {source: renderer.source, statsKey, units, ...stats};
        renderer.dcsCache.set(cacheId, entry);
    }
    const affineKey = JSON.stringify(cfg);
    if (entry.affineKey !== affineKey) {
        entry.affine = computeAffine(renderer, entry, region, cfg, exact);
        entry.affineKey = affineKey;
    }
    return entry.affine;
}

function liveStats(renderer, region) {
    const sample = renderer.sampleIngress(region, SAMPLE_RES);
    if (!sample) return null;
    const count = SAMPLE_RES * SAMPLE_RES;
    return {moments: finalizeMoments(accumulateMoments(sample, count)), sample, count};
}

// Full-resolution moments over the region, merged tile by tile.
function exportStats(renderer, region) {
    let moments = {n: 0, mean: [0, 0, 0], M2: [[0, 0, 0], [0, 0, 0], [0, 0, 0]]};
    let buffer = null;
    const ok = renderer.forEachIngressTile(region, TILE_SIZE, (target, w, h) => {
        buffer ??= new Float32Array(target.width * target.height * 4);
        renderer.readF32Target(target, w, h, buffer);
        moments = mergeMoments(moments, accumulateMoments(buffer, w * h));
    });
    if (!ok) return null;
    return {moments: finalizeMoments(moments)};
}

// The transform is computed on statistics in data units, then rewritten as
// a transform of the input values, which the bounds passes and the shader
// operate on. Its output (and so the bounds) is identical either way.
function computeAffine(renderer, entry, region, cfg, exact) {
    const {A, B} = entry.units;
    const dataTransform = dcsTransform(scaleStats(entry.moments, A, B), cfg.sigma);
    if (!dataTransform) return null;
    const transform = transformToInputUnits(dataTransform, A, B);
    let lo, hi;
    if (cfg.stretch === StretchEnum.JOINT) {
        const bounds = reduceMinMax(renderer, region, transform);
        if (!bounds) return null;
        lo = [bounds[0], bounds[0], bounds[0]];
        hi = [bounds[1], bounds[1], bounds[1]];
    } else {
        const pLow = cfg.low;
        const pHigh = 100 - cfg.high;
        [lo, hi] = exact
            ? histogramPercentiles(renderer, region, transform, pLow, pHigh)
            : samplePercentiles(entry, transform, pLow, pHigh);
        if (!lo) return null;
        // A zero tail is the channel's true min/max; the sample would miss
        // it, so take it exactly from the full-resolution reduction.
        if (!exact && (cfg.low === 0 || cfg.high === 0)) {
            for (let j = 0; j < 3; j++) {
                const bounds = reduceMinMax(renderer, region, transform, j);
                if (!bounds) return null;
                if (cfg.low === 0) lo[j] = bounds[0];
                if (cfg.high === 0) hi[j] = bounds[1];
            }
        }
    }
    return foldAffine(transform, lo, hi);
}

// Per-channel percentiles of the transformed live sample (exact numpy
// semantics on the sample).
function samplePercentiles(entry, transform, pLow, pHigh) {
    const out = applyTransform(entry.sample, entry.count, transform);
    const lo = [], hi = [];
    for (let j = 0; j < 3; j++) {
        const vals = [];
        for (let i = 0; i < entry.count; i++) {
            const v = out[i * 3 + j];
            if (Number.isFinite(v)) vals.push(v);
        }
        if (vals.length === 0) return [null, null];
        const sorted = Float64Array.from(vals).sort();
        lo.push(percentileFromSorted(sorted, pLow));
        hi.push(percentileFromSorted(sorted, pHigh));
    }
    return [lo, hi];
}

// Exact per-channel percentiles (numpy linear interpolation) of the
// transformed region at full resolution, without holding the image: pass 1
// builds a histogram per channel over its own exact [min, max] (from the GPU
// reduction); pass 2 collects only the values in the bins that hold the
// needed ranks, which are then sorted to select them exactly.
function histogramPercentiles(renderer, region, transform, pLow, pHigh) {
    const ranges = [];
    for (let j = 0; j < 3; j++) {
        const bounds = reduceMinMax(renderer, region, transform, j);
        if (!bounds) return [null, null];
        ranges.push(bounds);
    }
    const binWidths = ranges.map(([lo, hi]) => (hi - lo) / HIST_BINS || 1);
    const binOf = (j, v) => Math.min(
        HIST_BINS - 1, Math.max(0, Math.floor((v - ranges[j][0]) / binWidths[j]))
    );
    let buffer = null;
    let out = null;
    const forEachValue = visit => renderer.forEachIngressTile(region, TILE_SIZE, (target, w, h) => {
        buffer ??= new Float32Array(target.width * target.height * 4);
        out ??= new Float64Array(target.width * target.height * 3);
        renderer.readF32Target(target, w, h, buffer);
        applyTransform(buffer, w * h, transform, 4, out);
        for (let i = 0; i < w * h; i++) {
            for (let j = 0; j < 3; j++) {
                const v = out[i * 3 + j];
                if (Number.isFinite(v)) visit(j, v);
            }
        }
    });

    const hists = [0, 1, 2].map(() => new Float64Array(HIST_BINS));
    const totals = [0, 0, 0];
    forEachValue((j, v) => {
        hists[j][binOf(j, v)]++;
        totals[j]++;
    });
    if (totals.some(n => n === 0)) return [null, null];

    // For each channel and percentile, the two ranks numpy interpolates
    // between, and the bins holding them.
    const queries = [0, 1, 2].map(j => [pLow, pHigh].map(p => {
        const {k0, k1, frac} = percentileRanks(totals[j], p);
        return {frac, ranks: [k0, k1].map(k => ({k, ...locateRank(hists[j], k)}))};
    }));
    const wanted = [0, 1, 2].map(j => new Map(
        queries[j].flatMap(q => q.ranks.map(r => [r.bin, []]))
    ));
    forEachValue((j, v) => wanted[j].get(binOf(j, v))?.push(v));
    wanted.forEach(bins => bins.forEach(vals => vals.sort((a, b) => a - b)));
    const select = (j, {k, bin, below}) => wanted[j].get(bin)[k - below];
    const resolve = (j, {frac, ranks: [r0, r1]}) => {
        const v0 = select(j, r0);
        return v0 + (select(j, r1) - v0) * frac;
    };
    return [
        [0, 1, 2].map(j => resolve(j, queries[j][0])),
        [0, 1, 2].map(j => resolve(j, queries[j][1])),
    ];
}

const minmaxPrograms = new WeakMap();

function getMinmaxProgram(renderer) {
    let entry = minmaxPrograms.get(renderer);
    if (entry) return entry;
    if (!minmaxSources.src) return null;
    const gl = renderer.gl;
    const fs = renderer.compile(gl.FRAGMENT_SHADER, minmaxSources.src, {});
    const program = gl.createProgram();
    gl.attachShader(program, renderer.vertexShader);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`dcs_minmax link failed: ${gl.getProgramInfoLog(program)}`);
    }
    const loc = name => gl.getUniformLocation(program, name);
    entry = {
        program,
        uniforms: {
            image: loc("u_image"), inSize: loc("u_inSize"), first: loc("u_first"),
            channel: loc("u_channel"),
            t0: loc("u_t0"), t1: loc("u_t1"), t2: loc("u_t2"), c: loc("u_c"),
        },
    };
    minmaxPrograms.set(renderer, entry);
    return entry;
}

/**
 * Exact [min, max] of the DCS output over all pixels of the region at native
 * resolution, jointly over all channels or (channel 0-2) for one channel:
 * each tile is reduced on the GPU in 4x4 blocks until it is at most 16x16,
 * then finished on the CPU.
 * @returns {[number, number]|null}
 */
function reduceMinMax(renderer, region, {T, c}, channel = -1) {
    const prog = getMinmaxProgram(renderer);
    if (!prog) return null;
    const gl = renderer.gl;
    const cols = [0, 1, 2].map(j => [T[0][j], T[1][j], T[2][j]]);
    let lo = Infinity, hi = -Infinity;
    const levels = [];
    const ok = renderer.forEachIngressTile(region, TILE_SIZE, (tile, w, h) => {
        gl.useProgram(prog.program);
        gl.uniform1i(prog.uniforms.image, 0);
        gl.uniform3fv(prog.uniforms.t0, cols[0]);
        gl.uniform3fv(prog.uniforms.t1, cols[1]);
        gl.uniform3fv(prog.uniforms.t2, cols[2]);
        gl.uniform3fv(prog.uniforms.c, c);
        gl.uniform1i(prog.uniforms.channel, channel);
        gl.bindVertexArray(renderer.vao);
        let input = tile;
        let first = true;
        let level = 0;
        while (first || w > 16 || h > 16) {
            const ow = Math.ceil(w / 4), oh = Math.ceil(h / 4);
            if (!levels[level]) {
                levels[level] = renderer.makeF32Target(
                    Math.ceil(input.width / 4), Math.ceil(input.height / 4)
                );
            }
            const out = levels[level];
            gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
            gl.viewport(0, 0, ow, oh);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, input.texture);
            gl.uniform2i(prog.uniforms.inSize, w, h);
            gl.uniform1i(prog.uniforms.first, first ? 1 : 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.bindTexture(gl.TEXTURE_2D, null);
            input = out;
            [w, h] = [ow, oh];
            first = false;
            level++;
        }
        const px = renderer.readF32Target(input, w, h);
        for (let i = 0; i < w * h; i++) {
            if (px[i * 4 + 2] <= 0) continue;
            lo = Math.min(lo, px[i * 4]);
            hi = Math.max(hi, px[i * 4 + 1]);
        }
    });
    levels.forEach(target => renderer.deleteF32Target(target));
    if (!ok || !(hi >= lo)) return null;
    return [lo, hi];
}

export const effectMeta = {
    group: "Color",
    tags: ["dcs", "decorrelation", "stretch", "color", "pca", "enhance"],
    description: (
        "Decorrelation stretch (Gillespie et al. 1986), following " +
        "marslab's implementation: rotates colors into the principal " +
        "components of the image's bands, equalizes their variance, and " +
        "rotates back, exaggerating subtle color differences. Statistics " +
        "come from the image's own bands (or Debayer's RGB composite) after " +
        "Input Stretch, over the whole image or the current view, and the " +
        "transform is applied to this effect's input. Computed in the " +
        "image's original data units (0-255 for browser images), or in " +
        "stretched units when Input Stretch uses a nonlinear curve. No-op " +
        "for one- or two-band images. Exports recompute statistics at full " +
        "resolution."
    ),
    backend: "gpu",
    // Float32 output: a no-op passes its float32 input through unrounded,
    // and downstream effects and exports see the stretch at full precision.
    requires_f32: true,
    canAnimate: false,
    realtimeSafe: true,
    notInRandom: true,
};

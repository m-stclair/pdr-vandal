import {initGLEffect, loadFragSrcInit} from "../../utils/gl.js";
import {blockSample} from "./probeutils.js";
import {clamp} from "../../utils/mathutils.js";

const shaderPath = "blockprobe.frag"
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


function expandSwatchVariants([L, a, b], deltaL = 10, chromaExp = 1.0) {
    const C = Math.hypot(a, b);
    const h = Math.atan2(b, a);
    const Cmod = Math.pow(C, chromaExp);
    const anew = Math.cos(h) * Cmod;
    const bnew = Math.sin(h) * Cmod;
    return [
        [L, anew, bnew],
        [clamp(L + deltaL, 0, 100), anew, bnew],
        [clamp(L - deltaL, 0, 100), anew, bnew]
    ];
}

function seededNotVeryRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return () => {
        x = Math.sin(x) * 10000;
        return x - Math.floor(x);
    };
}

function score_outlier([L, a, b], [Lc, ac, bc]) {
    return Math.sqrt((L - Lc) ** 2 + (a - ac) ** 2 + (b - bc) ** 2);
}

function score_luma_outlier([L, a, b], [Lc, ac, bc]) {
    return Math.abs(L - Lc) / 100;
}

function score_hue_outlier([L, a, b], [Lc, ac, bc]) {
    const C = Math.hypot(a, b);
    const h = Math.atan2(b, a);
    const hc = Math.atan2(bc, ac);
    if ((L < 20) || (C < 20)) return 0;
    return Math.abs(h - hc);
}

function score_midtones([L, a, b]) {
    const C = Math.sqrt(a * a + b * b);
    const balance = 100 - Math.abs((L - 50) * 2.0);
    return balance * C / 100;
}

function meanLab(samples) {
    const sum = [0, 0, 0];
    for (const [L, a, b] of samples) {
        sum[0] += L;
        sum[1] += a;
        sum[2] += b;
    }
    const n = samples.length;
    return [sum[0] / n, sum[1] / n, sum[2] / n];
}

function scoreLabSwatch(
    lab,
    meanLab,
    weights = {outlier: 1.0, midtone: 1.0, luma: 1.0, hue: 1.0}
) {
    return weights.outlier * score_outlier(lab, meanLab)
        + weights.midtone * score_midtones(lab)
        + weights.luma * score_luma_outlier(lab, meanLab)
        + weights.hue * score_hue_outlier(lab, meanLab)
}

function scoreAndSortPalette(candidates, weights) {
    const center = meanLab(candidates);
    return candidates
        .map(lab => ({lab, score: scoreLabSwatch(lab, center, weights)}))
        .sort((a, b) => b.score - a.score);
}

function selectTopNScoredSwatches(candidates, weights, N) {
    const scored = scoreAndSortPalette(candidates, weights);
    return scored.slice(0, N).map(entry => entry.lab);
}

export const paletteprobe = {
    config: {blockSize: null, paletteSize: null, patchOrigins: null},
    analyze(
        probe,
        inputTexture,
        width,
        height,
        paletteSize,
        deltaL,
        gammaC,
        blockSize,
        seed,
        selectionWeights
    ) {
        initGLEffect(probe, fragSources);
        const gl = probe.glState.gl;
        probe.config.blockSize = blockSize;
        // x5 oversampling for scoring
        probe.config.paletteSize = paletteSize * 5;
        probe.config.patchOrigins = []
        const rng = seededNotVeryRandom(seed);
        for (let p = 1; p < paletteSize; p++) {
            const pX = rng() * width;
            const pY = rng() * height
            probe.config.patchOrigins.push([pX, pY])
        }
        const outData = blockSample(
            probe, width, height, gl, inputTexture, seed
        );
        const baseSwatches = [];
        for (let i = 0; i < outData.length / 4; i++) {
            const idx = i * 4;
            const L = outData[idx]
            const a = outData[idx + 1];
            const b = outData[idx + 2];
            baseSwatches.push([L, a, b]);
        }
        const selected = selectTopNScoredSwatches(baseSwatches, selectionWeights, paletteSize);
        const expanded = selected.map(s => expandSwatchVariants(s, deltaL, gammaC)).flat();
        // const normalized = expanded.map(e => normalizeLab(e));
        return expanded.sort((a, b) => a[0] - b[0]);
    },
    initHook: fragSources.load
}

import {makeEnum} from "../utils/glsl_enums.js";
import {approxPercentiles} from "../utils/stretch.js";

// Settings-only module: GlitchRenderer.loadImage() reads this effect's config
// and demosaics the native-resolution source during ingress.

const {
    enum: BayerPatternEnum,
    options: BayerPatternOpts
} = makeEnum(['RGGB', 'BGGR', 'GRBG', 'GBRG']);

const {
    enum: DebayerMethodEnum,
    options: DebayerMethodOpts
} = makeEnum(['BILINEAR', 'MALVAR', 'SUBSAMPLE']);

const {
    enum: DebayerChannelEnum,
    options: DebayerChannelOpts
} = makeEnum(['RED', 'GREEN', 'BLUE']);

// SUBSAMPLE-only: one CFA site per 2x2 cell. GREEN1/GREEN2 are the first and
// second green sites in raster order within the cell.
const {
    enum: DebayerPlaneEnum,
    options: DebayerPlaneOpts
} = makeEnum(['RED', 'BLUE', 'GREEN1', 'GREEN2']);

// Region whose statistics drive AUTO gains.
const {
    enum: AutoRegionEnum,
    options: AutoRegionOpts
} = makeEnum(['WHOLE_IMAGE', 'CURRENT_VIEW']);

const RGB_ACTIVE = [
    {key: "METHOD", notEquals: DebayerMethodEnum.SUBSAMPLE},
    {key: "RGB", equals: true},
];
const GAIN_SPEC = {type: "range", min: 0, max: 8, step: 0.01};

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Debayer",
    defaultConfig: {
        PATTERN: BayerPatternEnum.RGGB,
        METHOD: DebayerMethodEnum.BILINEAR,
        CHANNEL: DebayerChannelEnum.GREEN,
        PLANE: DebayerPlaneEnum.GREEN1,
        RGB: false,
        GAIN_R: 1.0,
        GAIN_G: 1.0,
        GAIN_B: 1.0,
        AUTO: false,
        AUTO_REGION: AutoRegionEnum.WHOLE_IMAGE,
    },
    uiLayout: [
        {type: "select", key: "PATTERN", label: "Bayer Pattern", options: BayerPatternOpts},
        {type: "select", key: "METHOD", label: "Method", options: DebayerMethodOpts},
        {
            type: "checkbox", key: "RGB", label: "RGB Composite",
            showIf: {key: "METHOD", notEquals: DebayerMethodEnum.SUBSAMPLE}
        },
        {
            type: "select", key: "CHANNEL", label: "Output Channel", options: DebayerChannelOpts,
            showIf: [
                {key: "METHOD", notEquals: DebayerMethodEnum.SUBSAMPLE},
                {key: "RGB", notEquals: true},
            ]
        },
        {
            type: "select", key: "PLANE", label: "Output Channel", options: DebayerPlaneOpts,
            showIf: {key: "METHOD", equals: DebayerMethodEnum.SUBSAMPLE}
        },
        {...GAIN_SPEC, key: "GAIN_R", label: "Red Gain", showIf: RGB_ACTIVE},
        {...GAIN_SPEC, key: "GAIN_G", label: "Green Gain", showIf: RGB_ACTIVE},
        {...GAIN_SPEC, key: "GAIN_B", label: "Blue Gain", showIf: RGB_ACTIVE},
        {type: "checkbox", key: "AUTO", label: "Auto Balance", showIf: RGB_ACTIVE},
        {
            type: "select", key: "AUTO_REGION", label: "Auto Region", options: AutoRegionOpts,
            showIf: [...RGB_ACTIVE, {key: "AUTO", equals: true}]
        },
    ],
};

export {DebayerMethodEnum, AutoRegionEnum};

// CFA class (0=R, 1=G, 2=B) at [row][col] of the 2x2 cell, per BayerPatternEnum.
const CELL_CLASSES = [
    [[0, 1], [1, 2]], // RGGB
    [[2, 1], [1, 0]], // BGGR
    [[1, 0], [2, 1]], // GRBG
    [[1, 2], [0, 1]], // GBRG
];

/**
 * [dx, dy] of the selected plane's site within a 2x2 Bayer cell. Mirrors
 * planeOffset() in shaders/debayer.frag.
 * @param {number} pattern BayerPatternEnum value
 * @param {number} plane DebayerPlaneEnum value
 * @returns {[number, number]}
 */
export function planeOffset(pattern, plane) {
    const cell = CELL_CLASSES[pattern];
    const target = plane === DebayerPlaneEnum.RED ? 0
        : plane === DebayerPlaneEnum.BLUE ? 2 : 1;
    let skip = plane === DebayerPlaneEnum.GREEN2 ? 1 : 0;
    for (let i = 0; i < 4; i++) {
        const dx = i & 1;
        const dy = i >> 1;
        if (cell[dy][dx] === target) {
            if (skip === 0) return [dx, dy];
            skip--;
        }
    }
    return [0, 0];
}

// Percentile of each band mapped to 1.0 by AUTO gains.
const AUTO_PERCENTILE = 99.5;
// Upper bound on samples per band used for AUTO statistics.
const AUTO_MAX_SAMPLES = 1 << 20;

/**
 * Per-band gains that map each band's AUTO_PERCENTILE to 1.0, from the raw
 * CFA samples (no interpolation) of a single-band mosaic within rect.
 * @param {Float32Array} data raw mosaic, row-major, values nominally in [0, 1]
 * @param {number} width
 * @param {number} height
 * @param {number} pattern BayerPatternEnum value
 * @param {{x0: number, y0: number, x1: number, y1: number}} rect source
 *   pixels, half-open
 * @returns {[number, number, number]} [R, G, B] gains, rounded to the slider
 *   step and clamped to its range
 */
export function computeAutoGains(data, width, height, pattern, rect) {
    const x0 = Math.max(0, Math.floor(rect.x0));
    const y0 = Math.max(0, Math.floor(rect.y0));
    const x1 = Math.min(width, Math.ceil(rect.x1));
    const y1 = Math.min(height, Math.ceil(rect.y1));
    const cell = CELL_CLASSES[pattern];
    // Stride in whole 2x2 cells so every CFA site stays represented.
    const nCells = Math.max(1, ((x1 - x0) * (y1 - y0)) / 4);
    const cellStep = Math.max(1, Math.ceil(Math.sqrt(nCells / AUTO_MAX_SAMPLES)));
    const bands = [[], [], []];
    for (let y = y0; y < y1; y++) {
        if (((y - y0) >> 1) % cellStep) continue;
        const row = cell[y & 1];
        for (let x = x0; x < x1; x++) {
            if (((x - x0) >> 1) % cellStep) continue;
            const v = data[y * width + x];
            if (Number.isFinite(v)) bands[row[x & 1]].push(v);
        }
    }
    return bands.map(samples => {
        if (samples.length === 0) return 1;
        const [, hi] = approxPercentiles(samples, 0, AUTO_PERCENTILE, 4096, true);
        const gain = hi > 0 ? 1 / hi : 1;
        return Math.round(Math.min(Math.max(gain, GAIN_SPEC.min), GAIN_SPEC.max) * 100) / 100;
    });
}

export const effectMeta = {
    group: "Utility",
    tags: ["debayer", "demosaic", "bayer", "raw", "preprocessing"],
    description: (
        "Reconstructs a full-resolution R, G, or B channel, or a gain-" +
        "balanced RGB composite, from raw Bayer-mosaic data via bilinear " +
        "or Malvar-He-Cutler demosaicking, " +
        "or extracts a single half-resolution CFA plane (R, B, G1, or G2) " +
        "without interpolation. " +
        "Applied to the raw image before all other effects, regardless of " +
        "stack position; only the first enabled Debayer is used."
    ),
    canAnimate: false,
    realtimeSafe: true,
};

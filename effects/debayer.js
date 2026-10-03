import {makeEnum} from "../utils/glsl_enums.js";

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

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Debayer",
    defaultConfig: {
        PATTERN: BayerPatternEnum.RGGB,
        METHOD: DebayerMethodEnum.BILINEAR,
        CHANNEL: DebayerChannelEnum.GREEN,
        PLANE: DebayerPlaneEnum.GREEN1,
    },
    uiLayout: [
        {type: "select", key: "PATTERN", label: "Bayer Pattern", options: BayerPatternOpts},
        {type: "select", key: "METHOD", label: "Method", options: DebayerMethodOpts},
        {
            type: "select", key: "CHANNEL", label: "Output Channel", options: DebayerChannelOpts,
            showIf: {key: "METHOD", notEquals: DebayerMethodEnum.SUBSAMPLE}
        },
        {
            type: "select", key: "PLANE", label: "Output Channel", options: DebayerPlaneOpts,
            showIf: {key: "METHOD", equals: DebayerMethodEnum.SUBSAMPLE}
        },
    ],
};

export {DebayerMethodEnum};

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

export const effectMeta = {
    group: "Utility",
    tags: ["debayer", "demosaic", "bayer", "raw", "preprocessing"],
    description: (
        "Reconstructs a full-resolution R, G, or B channel from raw " +
        "Bayer-mosaic data via bilinear or Malvar-He-Cutler demosaicking, " +
        "or extracts a single half-resolution CFA plane (R, B, G1, or G2) " +
        "without interpolation. " +
        "Applied to the raw image before all other effects, regardless of " +
        "stack position; only the first enabled Debayer is used."
    ),
    canAnimate: false,
    realtimeSafe: true,
};

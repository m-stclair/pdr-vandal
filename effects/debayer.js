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
} = makeEnum(['BILINEAR', 'MALVAR']);

const {
    enum: DebayerChannelEnum,
    options: DebayerChannelOpts
} = makeEnum(['RED', 'GREEN', 'BLUE']);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Debayer",
    defaultConfig: {
        PATTERN: BayerPatternEnum.RGGB,
        METHOD: DebayerMethodEnum.BILINEAR,
        CHANNEL: DebayerChannelEnum.GREEN,
    },
    uiLayout: [
        {type: "select", key: "PATTERN", label: "Bayer Pattern", options: BayerPatternOpts},
        {type: "select", key: "METHOD", label: "Method", options: DebayerMethodOpts},
        {type: "select", key: "CHANNEL", label: "Output Channel", options: DebayerChannelOpts},
    ],
};

export const effectMeta = {
    group: "Utility",
    tags: ["debayer", "demosaic", "bayer", "raw", "preprocessing"],
    description: (
        "Reconstructs a full-resolution R, G, or B channel from raw " +
        "Bayer-mosaic data via bilinear or Malvar-He-Cutler demosaicking. " +
        "Applied to the raw image before all other effects, regardless of " +
        "stack position; only the first enabled Debayer is used."
    ),
    canAnimate: false,
    realtimeSafe: true,
};

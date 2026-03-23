import {resolveAnimAll} from "../utils/animutils.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
    hasChromaBoostImplementation,
    makeEnum
} from "../utils/glsl_enums.js";
import {blendControls, group} from "../utils/ui_configs.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";

const shaderPath = "threshold.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: ThresholdEnum,
    names: ThresholdNames,
    options: ThresholdOpts
} = makeEnum([
    'LUMA_ABSOLUTE',
    'CHANNEL_KEY_LUMA',
    'CHANNEL_KEY_CHROMA',
    'CHANNEL_KEY_HUE'
])

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Threshold",
    defaultConfig: {
        blendAmount: 1,
        COLORSPACE: ColorspaceEnum.RGB,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        thresholdMode: ThresholdEnum.LUMA_ABSOLUTE,
        chromaBoost: 1,
        target: 0.5,
        threshWidth: 0.1,
        binarize: false,
        flip: false
    },
    uiLayout: [
        {'type': 'select', 'key': 'thresholdMode', 'label': 'Threshold Mode', 'options': ThresholdOpts},
        {'type': 'modSlider', 'key': 'target', 'label': 'Target Value', 'min': 0, 'max': 1, 'step': 0.01},
        {
            'type': 'modSlider', 'key': 'threshWidth', 'label': 'Width', 'min': 0, 'max': 1, 'step': 0.01,
            showIf: {key: "thresholdMode", notEquals: ThresholdEnum.LUMA_ABSOLUTE}
        },
        {'type': 'checkbox', 'key': 'binarize', 'label': 'Binarize'},
        {'type': 'checkbox', 'key': 'flip', 'label': 'Flip'},
        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            blendAmount, thresholdMode, target, threshWidth, binarize, flip,
            COLORSPACE, BLEND_CHANNEL_MODE, BLENDMODE, chromaBoost,
        } = resolveAnimAll(instance.config, t);
        const uniformSpec = {
            u_target: {type: "float", value: target},
            u_width: {type: "float", value: threshWidth},
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {type: "float", value: blendAmount},
            u_chromaBoost: {type: "float", value: chromaBoost},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            THRESHOLD_MODE: thresholdMode,
            BINARIZE: Number(binarize),
            FLIP: Number(flip)
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
};

export const effectMeta = {
    group: "Utility",
    tags: ["threshold", "chromakey", "channel", "binary"],
    description: (
        "Simple threshold effect. Can operate either on absolute luma or a " +
        "channel key (luma, chroma, or hue). Optionally converts the " +
        "image to binary black/white."
    ),
    canAnimate: true,
    realtimeSafe: true,
}

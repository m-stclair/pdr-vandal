import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, hasChromaBoostImplementation,
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "aberration.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Chromatic Aberration",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        chromaBoost: 1,
        rdx: 0, rdy: 0,
        gdx: 0, gdy: 0,
        bdx: 0, bdy: 0,

    },
    uiLayout: [
        {type: "modSlider", key: "rdx", label: "Channel 1 X", min: -50, max: 50, step: 1},
        {type: "modSlider", key: "rdy", label: "Channel 1 Y", min: -50, max: 50, step: 1},
        {type: "modSlider", key: "gdx", label: "Channel 2 X", min: -50, max: 50, step: 1},
        {type: "modSlider", key: "gdy", label: "Channel 2 Y", min: -50, max: 50, step: 1},
        {type: "modSlider", key: "bdx", label: "Channel 3 X", min: -50, max: 50, step: 1},
        {type: "modSlider", key: "bdy", label: "Channel 3 Y", min: -50, max: 50, step: 1},
        blendControls()
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            blendAmount, COLORSPACE, BLENDMODE, rdx, rdy,
            gdx, gdy, bdx, bdy, BLEND_CHANNEL_MODE, chromaBoost
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_blendamount: {type: "float", value: blendAmount},
            u_resolution: {type: "vec2", value: [width, height]},
            u_shift0: {value: [rdx / width, rdy / height], "type": "vec2"},
            u_shift1: {value: [gdx / width, gdy / height], "type": "vec2"},
            u_shift2: {value: [bdx / width, bdy / height], "type": "vec2"},
            u_chromaBoost: {value: chromaBoost, type: "float"}
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE
        }
        instance.glState.renderGL(inputTex, outputFBO, uniforms, defines);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    initHook: fragSources.load,
    glState: null,
    isGPU: true
}

export const effectMeta = {
    group: "Color",
    tags: ["color", "shift", "displacement", "chromatic", "gpu"],
    description: "Applies independent shifts to color channels " +
        "to create chromatic aberration, blur, and blend effects. Multiple " +
        "colorspaces are available for shift application.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true
};
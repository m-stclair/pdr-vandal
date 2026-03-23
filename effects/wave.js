import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum,
    hasChromaBoostImplementation} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "wave.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @type {EffectModule} */
export default {
    name: "Wave Distortion",
    defaultConfig: {
        amplitude: 0.1,
        frequency: 1,
        direction: "horizontal",
        phase: 0,
        COLORSPACE: ColorspaceEnum.RGB,
        BLENDMODE: BlendModeEnum.MIX,
        blendAmount: 1,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        chromaBoost: 1
    },
    uiLayout: [
        {type: "select", key: "direction", label: "Direction", options: ["horizontal", "vertical"]},
        {type: "modSlider", key: "amplitude", label: "Amplitude", min: 0, max: 1, step: 0.01},
        {type: "modSlider", key: "frequency", label: "Frequency", min: 0.5, max: 20, step: 0.1},
        {type: "modSlider", key: "phase", label: "Phase", min: -1, max: 1, step: 0.01},
        blendControls()
    ],

    // TODO: expose a bound clip option
    apply(instance, inputTex, width, height, t, outputFBO) {
        const {
            direction, amplitude, frequency, phase, blendAmount, chromaBoost,
            COLORSPACE, BLENDMODE, BLEND_CHANNEL_MODE
        } = resolveAnimAll(instance.config, t);
        initGLEffect(instance, fragSources);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_phase: {value: phase * Math.PI, type: "float"},
            u_amp: {value: amplitude, type: "float"},
            u_freq: {value: frequency * 2 * Math.PI, type: "float"},
            u_vertical: {value: direction === "vertical" ? 1 : 0, type: "float"},
            u_blendamount: {value: blendAmount, type: "float"},
            u_chromaBoost: {value: chromaBoost, type: "float"}
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
        };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
}

export const effectMeta = {
    group: "Distortion",
    tags: ["patterns", "distortion", "gpu"],
    description: "Distorts the image in regular wave patterns.",
    canAnimate: true,
    realtimeSafe: true,
    notInRandom: true
};

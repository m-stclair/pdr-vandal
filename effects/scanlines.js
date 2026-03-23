import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendModeOpts,
    BlendTargetEnum,
    ColorspaceEnum,
    hasChromaBoostImplementation
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "scanlines.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @type {EffectModule} */
export default {
    name: "Scanlines",
    defaultConfig: {
        lineSpacing: 200,
        intensity: 0.5,
        phase: 0,
        blendAmount: 1,
        BLENDMODE: BlendModeEnum.SOFT_LIGHT,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        chromaBoost: 1
    },
    uiLayout: [
        {type: "modSlider", key: "lineSpacing", label: "Line Spacing", min: 25, max: 1000, step: 5},
        {type: "modSlider", key: "phase", label: "Phase", min: -1, max: 1, step: 0.01},
        {type: "modSlider", key: "intensity", label: "Intensity", min: 0.1, max: 1, step: 0.1},
        blendControls()
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        const {
            lineSpacing, intensity, phase, blendAmount, BLENDMODE,
            BLEND_CHANNEL_MODE, COLORSPACE, chromaBoost
        } = resolveAnimAll(instance.config, t);
        initGLEffect(instance, fragSources);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_phase: {value: phase * Math.PI, type: "float"},
            u_intensity: {value: intensity, type: "float"},
            u_spacing: {value: lineSpacing, type: "float"},
            u_blendamount: {value: blendAmount, type: "float"},
            u_chromaBoost: {value: chromaBoost, type: "float"}
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            COLORSPACE: COLORSPACE,
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
  group: "Stylize",
  tags: ["scanlines", "retro", "overlay", "gpu", "patterns"],
  description: "Adds horizontal scanlines to simulate CRT-style rendering artifacts.",
  canAnimate: true,
  realtimeSafe: true,
  parameterHints: {
      intensity: {always: 1.0}
  },
  notInRandom: true
};


import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";
import {rgb2Lab} from "../utils/colorutils.js";

const shaderPath = "duotone.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Duotone",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        chromaBoost: 1,
        darkColor: [0, 0, 0.2],
        lightColor: [1, 0.4, 0.2],
        gamma: 1,
        shadowPoint: 0.2,
        highlightPoint: 0.8,
    },

    uiLayout: [
        {
            key: "darkColor",
            label: "Dark Color",
            type: "vector",
            subLabels: ["R", "G", "B"],
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: "lightColor",
            label: "Light Color",
            type: "vector",
            subLabels: ["R", "G", "B"],
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: "gamma",
            label: "Gamma",
            type: "modSlider",
            min: 0.1,
            max: 3,
            step: 0.01,
        },
        {
            key: "shadowPoint",
            label: "Shadow Point",
            type: "modSlider",
            min: 0,
            max: 0.5,
            step: 0.01,
        },
        {
            key: "highlightPoint",
            label: "Highlight Point",
            type: "modSlider",
            min: 0.5,
            max: 1,
            step: 0.01,
        },
        blendControls()
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            BLENDMODE, COLORSPACE, BLEND_CHANNEL_MODE, blendAmount,
            darkColor, lightColor, gamma, shadowPoint, highlightPoint
        } = resolveAnimAll(instance.config, t);

        const darkLab = rgb2Lab(...darkColor);
        const lightLab = rgb2Lab(...lightColor);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_gamma: {value: gamma, type: "float"},
            u_shadowPoint: {value: shadowPoint, type: "float"},
            u_highlightPoint: {value: highlightPoint, type: "float"},
            u_darkColor: {value: darkLab, type: "vec3"},
            u_lightColor: {value: lightLab, type: "vec3"},
            u_blendAmount: {value: blendAmount, type: "float"}
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
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
  group: "Stylize",
  tags: ["poster", "ink", "print"],
  description: "Simple duotone effect.",
  backend: "gpu",
  canAnimate: true,
  realtimeSafe: true,
  parameterHints: {
      lightColor: {"min": 0.3, "max": 1},
      darkColor: {"min": 0, "max": 0.2},
      gamma: {"min": 0.8, "max": 1.2},
      shadowPoint: {"min": 0.1, "max": 0.3},
      highlightPoint: {"min": 0.7, "max": 0.9}
  },
  // notInRandom: true
};

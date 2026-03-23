import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";

const shaderPath = "bcs.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "B/C/S",

    defaultConfig: {
        brightness: 0.0,
        contrast: 0.0,
        saturation: 0.0,
        graypoint: 0.3,
    },

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            brightness,
            contrast,
            saturation,
            graypoint
        } = resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_brightness: {value: brightness, type: "float"},
            u_contrast: {value: contrast + 1, type: "float"},
            u_saturation: {value: saturation + 1, type: "float"},
            u_graypoint: {value: graypoint, type: "float"},
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
    uiLayout: [
        {
            key: "brightness",
            label: "Brightness",
            type: "modSlider",
            min: -1,
            max: 1,
            step: 0.01,
        },
        {
            key: "contrast",
            label: "Contrast",
            type: "modSlider",
            min: -1,
            max: 1,
            step: 0.01,
        },
        {
            key: "saturation",
            label: "Saturation",
            type: "modSlider",
            min: -1,
            max: 1,
            step: 0.01,
        },
        {
            key: "graypoint",
            label: "Gray Point",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01,
        },
    ]
}

export const effectMeta = {
  group: "Utility",
  tags: ["color", "brightness", "contrast", "saturation"],
  description: "Adjusts brightness, contrast, and saturation.",
  backend: "gpu",
  canAnimate: true,
  realtimeSafe: true,
  parameterHints: {
      "brightness": {min: -0.2, max: 0.4},
      "contrast": {min: -0.3, max: 0.5}
  },
  notInRandom: true
};

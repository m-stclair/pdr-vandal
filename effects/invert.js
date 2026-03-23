import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {ColorspaceEnum, ColorspaceOpts} from "../utils/glsl_enums.js";

const shaderPath = "invert.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Invert",

    defaultConfig: {
        invert0: true,
        invert1: true,
        invert2: true,
        COLORSPACE: ColorspaceEnum.RGB
    },

    uiLayout: [
        { type: "checkbox", key: "invert0", label: "Channel 1" },
        { type: "checkbox", key: "invert1", label: "Channel 2" },
        { type: "checkbox", key: "invert2", label: "Channel 3" },
        { type: "select", key: "COLORSPACE", label: "Colorspace", options: ColorspaceOpts },
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources)
        const {
            COLORSPACE,  invert0, invert1, invert2
        } = resolveAnimAll(instance.config, t);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_invert0: {value: Number(invert0), type: "float"},
            u_invert1: {value: Number(invert1), type: "float"},
            u_invert2: {value: Number(invert2), type: "float"}
        };
        const defines = { COLORSPACE: COLORSPACE };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        if (instance.glState?.renderer) {
            instance.glState.renderer.deleteEffectFBO(instance.id);
        }
    },
    glState: null,
    isGPU: true
};

export const effectMeta = {
  group: "Utility",
  tags: ["color", "luminance", "utility", "preprocessing"],
  description: "Inverts selected channels in whatever colorspace Useful for " +
      "pre- or post-processing, and fun negative efffects ",
  backend: "gpu",
  canAnimate: false,
  realtimeSafe: true,
    // TODO: implement
    parameterHints: {
      notAll0: ["invert0", "invert1", "invert2"]
    }
};

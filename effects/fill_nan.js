import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    DebugModeOpts,
    ColorspaceOpts, ColorspaceEnum, hasChromaBoostImplementation, DebugModeEnum, DebugColorModeOpts, DebugColorModeEnum
} from "../utils/glsl_enums.js";

const shaderPath = "fill_nan.frag";
const includePaths = {};

const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Fill NaN",
    defaultConfig: {
        fillColor: [0, 1, 1]

    },
    uiLayout: [
        {
            key: "fillColor",
            label: "Fill Color",
            type: "vector",
            subLabels: ["R", "G", "B"],
            min: 0,
            max: 1,
            step: 0.01,
        },
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            fillColor
        } = resolveAnimAll(instance.config, t);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_fillColor: {type: "vec3", value: fillColor}
        };
        const defines = {};
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
};

export const effectMeta = {
    group: "Utility",
    tags: ["finite", "invalid"],
    description: "Mark NaN / masked values in the array with a color.",
    canAnimate: false,
    realtimeSafe: true,
};

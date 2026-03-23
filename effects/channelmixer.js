import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {ColorspaceEnum, hasChromaBoostImplementation, ColorspaceOpts} from "../utils/glsl_enums.js";

const shaderPath = "channelmixer.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Channel Mixer",

    defaultConfig: {
        mix1: [1, 0, 0],
        mix2: [0, 1, 0],
        mix3: [0, 0, 1],
        offset: [0, 0, 0],
        COLORSPACE: ColorspaceEnum.Lab
    },

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const resolved = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_mix1: {type: "vec3", value: resolved.mix1},
            u_mix2: {type: "vec3", value: resolved.mix2},
            u_mix3: {type: "vec3", value: resolved.mix3},
            u_offset: {type: "vec3", value: resolved.offset},
        };
        const defines = {
            COLORSPACE: Number.parseInt(resolved.COLORSPACE)
        }
        instance.glState.renderGL(inputTex, outputFBO, uniforms, defines);
    },

    uiLayout: [
        {
            key: "mix1",
            label: "Channel 1 Mix",
            type: "vector",
            subLabels: ["C1", "C2", "C3"],
            min: -2,
            max: 2,
            step: 0.01,
        },
        {
            key: "mix2",
            label: "Channel 2 Mix",
            type: "vector",
            subLabels: ["C1", "C2", "C3"],
            min: -2,
            max: 2,
            step: 0.01,
        },
        {
            key: "mix3",
            label: "Channel 3 Mix",
            type: "vector",
            subLabels: ["C1", "C2", "C3"],
            min: -2,
            max: 2,
            step: 0.01,
        },
        {
            key: "offset",
            label: "Offset",
            type: "vector",
            subLabels: ["C1", "C2", "C3"],
            min: -1,
            max: 1,
            step: 0.01,
        },
        {
            key: 'COLORSPACE',
            label: 'Colorspace',
            type: 'Select',
            options: ColorspaceOpts
        },
    ],
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    initHook: fragSources.load,
    glState: null,
    isGPU: true
}

export const effectMeta = {
  group: "Color",
  tags: ["color", "rgb", "hsv", "lab", "lch", "matrix", "webgl", "mix"],
  description: "GPU-accelerated  3×3 matrix mixer for RGB/Lab/LCH/HSV channels. " +
      "Much faster than the CPU version, but operates only" +
      "within, not across, colorspaces.",
  canAnimate: false,
  realtimeSafe: true,
    // TODO: would prefer otherwise, but hard to hint good mix
  notInRandom: true
};
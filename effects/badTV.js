import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, hasChromaBoostImplementation
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "badtv.frag"
const includePaths = {
    'noise.glsl': 'includes/noise.glsl',
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Bad TV",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        tearAmount: 0.2,
        flickerAmount: 0,
        jitter: 0.5,
        t_: 0,
        bias: 0.85,
        scale: 1000,
        seed: 0,
        chunks: 20,
        tearMode: "band",
        ghostOffset: 0.05,
        noiseAmount: 0.5,
        chromaBoost: 1
    },
    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            label: "Noise",
            children: [
               {
                    type: "range",
                    key: "noiseAmount",
                    label: "Amount",
                    min: 0,
                    max: 1,
                    steps: 200
                },
                {
                    type: "modSlider",
                    key: "jitter",
                    label: "Jitter",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "range",
                    key: "flickerAmount",
                    label: "Flicker",
                    min: 0,
                    max: 1,
                    steps: 100
                },

                {
                    type: "modSlider",
                    key: "scale",
                    label: "Scale",
                    min: 25,
                    max: 2000,
                    steps: 200,
                },
                {
                    type: "modSlider",
                    key: "bias",
                    label: "Bias",
                    min: 0,
                    max: 1,
                    steps: 200
                },
            ]
        },
        {
            type: "group",
            label: "Tear",
            kind: "collapse",
            children: [
                {
                    type: "modSlider",
                    key: "tearAmount",
                    label: "Amount",
                    min: 0,
                    max: 1,
                    steps: 100
                },
                {
                    type: "range",
                    key: "chunks",
                    label: "Chunks",
                    min: 1,
                    max: 64,
                    step: 1
                },
                {
                    type: "range",
                    key: "ghostOffset",
                    label: "Ghost",
                    min: 0,
                    max: 0.5,
                    step: 0.01
                },
                {
                    type: "select",
                    key: "tearMode",
                    options: ["wave", "jump", "band", "chunk", "ghost"]
                }
            ]
        },
        {
            type: "group",
            label: "Progression",
            kind: "collapse",
            children: [
                {
                    type: "modSlider",
                    key: "t_",
                    label: "Phase",
                    min: 0,
                    max: Math.PI * 2,
                    steps: 250
                },
                {
                    type: "range",
                    key: "seed",
                    label: "Seed",
                    min: 0,
                    max: 499,
                    step: 1
                },
            ]
        },
        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            blendAmount, COLORSPACE, BLENDMODE, BLEND_CHANNEL_MODE,
            flickerAmount, tearAmount, jitter, t_, bias, scale, seed, chunks,
            tearMode, ghostOffset, noiseAmount, chromaBoost
        } = resolveAnimAll(config, t);

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            "u_mod.seed": {type: "float", value: seed},
            "u_mod.scale": {type: "float", value: scale},
            "u_mod.t": {type: "float", value: t_},
            "u_mod.bias": {type: "float", value: bias},
            "u_mod.jitter": {type: "float", value: jitter},
            "u_mod.flickerAmount": {type: "float", value: flickerAmount},
            "u_mod.noiseAmount": {type: "float", value: noiseAmount},
            "u_mod.blendAmount": {type: "float", value: blendAmount},
            "u_tear.amount": {type: "float", value: tearAmount * 0.15},
            "u_tear.chunks": {type: "float", value: chunks},
            "u_tear.ghostOffset": {type: "float", value: ghostOffset},
            u_chromaBoost: {type: "float", value: chromaBoost}
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            TEARMODE: {'wave': 0, 'jump': 1, 'band': 2, 'chunk': 3, 'ghost': 4}[tearMode]
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
    group: "Stylize",
    tags: ["tv", "retro", "vhs", "analog", "noise", "gpu"],
    description: "Applies shaped noise, flicker, and tear. Can simulate " +
        "VHS dropout, NTSC hash, CRT raster offset, and failing analog broadcasts.",
    backend: "gpu",
    realtimeSafe: true,
    canAnimate: true
};
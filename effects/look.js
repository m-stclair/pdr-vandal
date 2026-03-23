import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {group} from "../utils/ui_configs.js";
import {hsv2Rgb} from "../utils/colorutils.js";

const shaderPath = "look.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Look",
    defaultConfig: {
        exposure: 0.2,
        toneShoulder: 2.2,
        toneCenter: -0.75,
        curveStrength: 1,
        chromaWeight: 1.0,
        chromaFadeLow: -3,
        chromaFadeHigh: 2,
        tintHue: 68,
        tintStrength: 0,
        lift: 0,
        gamma: 0,
        gain: 0
    },
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            exposure,
            chromaWeight,
            tintHue,
            tintStrength,
            chromaFadeLow,
            chromaFadeHigh,
            toneShoulder,
            toneCenter,
            lift,
            gamma,
            gain,
            curveStrength
        } = resolveAnimAll(instance.config, t);

        const tintNorm = tintHue / 360;
        const tint = hsv2Rgb(tintNorm, 1, 1);
        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_exposure: {value: exposure, type: "float"},
            u_chroma_weight: {value: chromaWeight, type: "float"},
            u_center: {value: toneCenter, type: "float"},
            u_shoulder: {value: toneShoulder, type: "float"},
            u_lift: {value: lift, type: "float"},
            u_gamma: {value: gamma, type: "float"},
            u_gain: {value: gain, type: "float"},
            u_chroma_fade_low: {value: chromaFadeLow, type: "float"},
            u_chroma_fade_high: {value: chromaFadeHigh, type: "float"},
            u_tint: {value: tint, type: "vec3"},
            u_tint_strength: {value: tintStrength, type: "float"},
            u_curve_strength: {value: curveStrength, type: "float"},
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
        group("Tone Mapping", [
            {
                key: "exposure",
                label: "Exposure",
                type: "modSlider",
                min: -5,
                max: 5,
                step: 0.05
            },
            {
                key: "curveStrength",
                label: "Curve Weight",
                type: "modSlider",
                min: 0,
                max: 1,
                step: 0.01
            },
            {
                type: "group",
                kind: "collapse",
                label: "Curve",
                children: [
                    {
                        key: "toneShoulder",
                        label: "Tone Shoulder",
                        type: "modSlider",
                        min: 1,
                        max: 6,
                        step: 0.02
                    },
                    {
                        key: "toneCenter",
                        label: "Tone Center",
                        type: "modSlider",
                        min: -3,
                        max: 1,
                        step: 0.05
                    },
                ]
            },
            {
                type: "group",
                kind: "collapse",
                label: "Grading",
                children: [
                    {
                        key: "lift",
                        label: "Lift",
                        type: "modSlider",
                        min: -0.2,
                        max: 0.2,
                        step: 0.01
                    },
                    {
                        key: "gamma",
                        label: "Gamma",
                        type: "modSlider",
                        min: -0.2,
                        max: 0.2,
                        step: 0.01
                    },
                    {
                        key: "gain",
                        label: "Gain",
                        type: "modSlider",
                        min: -0.2,
                        max: 0.2,
                        step: 0.01
                    }
                ]
            }

        ]),

        group("Chroma Rolloff", [
            {
                key: "chromaWeight",
                label: "Chroma Weight",
                type: "modSlider",
                min: 0,
                max: 4,
                step: 0.01
            },
            {
                key: "chromaFadeLow",
                label: "Chroma Fade Low Stop",
                type: "modSlider",
                min: -6,
                max: 6,
                step: 0.1
            },
            {
                key: "chromaFadeHigh",
                label: "Chroma Fade High Stop",
                type: "modSlider",
                min: -6,
                max: 6,
                step: 0.1
            }
        ]),

        group("Tint", [
            {
                key: "tintStrength",
                label: "Tint Strength",
                type: "modSlider",
                min: 0,
                max: 1,
                step: 0.01
            },
            {
                key: "tintHue",
                label: "Tint Hue",
                type: "modSlider",
                min: 0,
                max: 360,
                step: 0.01
            },

        ])
    ]

}

export const effectMeta = {
    group: "Utility",
    tags: ["color", "brightness", "contrast", "saturation", "chroma",
        "exposure", "warm", "lut", "chroma", "luma", "cool", "tint"],
    description: "Adjusts luma, chroma, tone, and tint, like a " +
        "procedurally-generated LUT. You might want this instead of B/C/S.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        toneShoulder: {min: -1.5, max: 1.5},
        exposure: {min: -0.3, max: 1.3},
        toneCenter: {min: -1.5, max: 0.2}
    },
    // just too hard to balance
    notInRandom: true
};

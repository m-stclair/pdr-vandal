import {resolveAnimAll} from "../utils/animutils.js";
import {cmapLuts, colormaps, LUTSIZE} from "../utils/colormaps.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation, GateModeEnum, GateModeOpts,
    ZoneShapeEnum,
} from "../utils/glsl_enums.js";
import {blendControls, zoneControls} from "../utils/ui_configs.js";

const shaderPath = "noisemixer.frag"
const includePaths = {
    'zones.glsl': 'includes/zones.glsl',
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
    'noise.glsl': 'includes/noise.glsl',
    'psrdnoise2.glsl': 'includes/noises/psrdnoise2.glsl',
    "classicnoise2D.glsl": 'includes/noises/classicnoise2D.glsl',
    "cellular2D.glsl": 'includes/noises/cellular2D.glsl',
    "noise2D.glsl": 'includes/noises/noise2D.glsl',
    'noisenums.glsl': "includes/noises/noisenums.glsl",
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Noise Mixer",
    defaultConfig: {
        frequency: 100,
        freqShift: 0,
        tint: [1, 1, 1],
        seed: 1,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        chromaBoost: 1,
        components: [0.5, 0, 0, 0, 0, 0.5, 0],
        blendAmount: 0.5,
        colormap: "none",
        threshold: 0,
        cutoff: 1,
        gate: GateModeEnum.NONE,
        burstThreshold: 0.1,
        burstFreq: 100,
        burstTheta: 0.52,
        burstDTheta: 0,
        ZONESHAPE: ZoneShapeEnum.SUPERELLIPSE,
        zoneCX: 0.5,
        zoneSX: 0.6,
        zoneCY: 0.5,
        zoneSY: 0.6,
        zoneEllipseN: 2,
        zoneSoftness: 0.1,
        zoneAngle: 0,
        APPLY_MASK: false,
        burstModType: "simplex",
        shiftX: 0,
        shiftY: 0
    },
    uiLayout: [
        {
            type: "group",
            label: "Core Noise",
            kind: 'collapse',
            collapsed: false,
            children: [
                {key: "seed", label: "Seed", type: "modSlider", min: 1, max: 500, step: 1},
                {
                    key: "components",
                    label: "Noise Components",
                    type: "vector",
                    subLabels: () => ["Uniform", "Perlin", "Simplex", "Gaussian", "Value", "Brown", "Worley"],
                    min: 0,
                    max: 1,
                    step: 0.01,
                    length: 7
                },
                {key: "frequency", label: "Frequency", type: "Range", min: 1, max: 5000, steps: 300, scale: "log"},
                {key: "freqShift", label: "X/Y", type: "Range", min: -1, max: 1, steps: 200},
            ]
        },

        {
            type: 'group',
            label: 'Gate Settings',
            kind: 'collapse',
            children: [
                {key: "gate", label: "Use Gate", type: "Select", options: GateModeOpts},
                {
                    key: "threshold",
                    label: "Low",
                    type: "modSlider",
                    min: 0,
                    max: 1,
                    steps: 200,
                    showIf: {'key': 'gate', 'notEquals': GateModeEnum.NONE},
                },
                {
                    key: "cutoff",
                    label: "High",
                    type: "modSlider",
                    min: 0,
                    max: 1,
                    steps: 200,
                    showIf: {'key': 'gate', 'notEquals': GateModeEnum.NONE},
                },
                {
                    key: "burstThreshold",
                    label: "Burst Threshold",
                    type: "modSlider",
                    min: 0,
                    max: 1,
                    steps: 200,
                    showIf: {'key': 'gate', 'equals': GateModeEnum.BURST}
                },
                {
                    key: "burstFreq",
                    label: "Burst Frequency",
                    type: "modSlider",
                    min: 1,
                    max: 5000,
                    steps: 300,
                    scale: "log",
                    showIf: {'key': 'gate', 'equals': GateModeEnum.BURST}
                },
                {
                    key: "burstModType",
                    label: "Burst Modulator Type",
                    type: "Select",
                    options: ["simplex", "pseudoperlin", "sinusoidal"],
                    showIf: {'key': 'gate', 'equals': GateModeEnum.BURST}
                },
                {
                    key: "burstTheta",
                    label: "Burst Angle",
                    type: "modSlider",
                    min: 0,
                    max: Math.PI,
                    steps: 100,
                    showIf: {'key': 'gate', 'equals': GateModeEnum.BURST}
                },
                {
                    key: "burstDTheta",
                    label: "Burst Angle Dispersion",
                    type: "modSlider",
                    min: 0,
                    max: Math.PI,
                    steps: 100,
                    showIf: {'key': 'gate', 'equals': GateModeEnum.BURST}
                },

            ],
        },
        blendControls(),
        {
            type: 'group',
            label: 'Color',
            kind: 'collapse',
            children: [
                {
                    type: "select",
                    key: "colormap",
                    label: "Colormap",
                    options: ["none", ...Object.keys(colormaps)]
                },
                {
                    key: "tint",
                    label: "Tint",
                    type: "vector",
                    subLabels: () => ["C1", "C2", "C3"],
                    min: 0,
                    max: 1,
                    length: 3,
                    step: 0.01,
                },
                ]
        },
        {key: "APPLY_MASK", label: "Apply Mask", type: "checkbox"},
        {...zoneControls(), showIf: {'key': 'APPLY_MASK', 'equals': true}},
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources)
        const {
            seed, frequency, freqShift, components,
            BLENDMODE, COLORSPACE, tint, blendAmount, colormap,
            threshold, cutoff, gate, burstThreshold, burstFreq,
            ZONESHAPE, zoneCX, zoneSX, zoneCY, zoneSY,
            zoneSoftness, zoneEllipseN, zoneAngle, APPLY_MASK,
            BLEND_CHANNEL_MODE, burstTheta, burstDTheta, burstModType,
            chromaBoost
        } = resolveAnimAll(instance.config, t);
        // TODO: this is wrong
        if (!components.some((c) => c)) return inputTex;
        const [uniform, perlin, simplex, gauss, value, brown, worley] = components;
        const noiseMax = brown + perlin + uniform + value + gauss + simplex + worley;
        const blendAmountC = (noiseMax < 1) ? Math.min(blendAmount, noiseMax) : blendAmount;
        let xMax = zoneCX + zoneSX / 2;
        let yMax = zoneCY + zoneSY / 2;
        let xMin = zoneCX - zoneSX / 2;
        let yMin = zoneCY - zoneSY / 2;
        const uniformSpec = {
            u_freqx: {type: "float", value: frequency * (1 + freqShift)},
            u_freqy: {type: "float", value: frequency * (1 - freqShift)},
            u_seed: {type: "float", value: seed / 11.3},
            u_resolution: {type: "vec2", value: [width, height]},
            u_perlin: {type: "float", value: perlin},
            u_gauss: {type: "float", value: gauss},
            u_uniform: {type: "float", value: uniform},
            u_brown: {type: "float", value: brown},
            u_value: {type: "float", value: value},
            u_worley: {type: "float", value: worley},
            u_simplex: {type: "float", value: simplex},
            u_threshold: {type: "float", value: threshold},
            u_cutoffHigh: {type: "float", value: cutoff},
            u_burstFreq: {type: "float", value: burstFreq},
            u_burstThreshold: {type: "float", value: burstThreshold},
            u_tint: {value: new Float32Array(tint), type: "vec3"},
            u_blendamount: {value: blendAmountC, type: "float"},
            u_chromaBoost: {type: "float", value: chromaBoost},
            u_zoneSoftness: {value: zoneSoftness, type: "float"},
            u_zoneEllipseN: {value: zoneEllipseN, type: "float"},
            u_zoneMin: {value: [xMin, yMin], type: "vec2"},
            u_zoneMax: {value: [xMax, yMax], type: "vec2"},
            u_zoneAngle: {value: zoneAngle, type: "float"},
            u_burstTheta: {value: burstTheta, type: "float"},
            u_burstPhi: {value: burstTheta + burstDTheta, type: "float"}
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            USE_CMAP: colormap === "none" ? 0 : 1,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            GATE_MODE: gate,
            USE_WINDOW: Number(cutoff < 1),
            ZONESHAPE: ZONESHAPE,
            APPLY_MASK: Number(APPLY_MASK),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            BURST_MODTYPE: {'simplex': 0, 'pseudoperlin': 1, 'sinusoidal': 2}[burstModType]
        }
        if (colormap !== "none") {
            uniformSpec["u_cmap"] = {
                value: instance.glState.getOrCreateLUT(colormap, cmapLuts[colormap]),
                type: "texture2D",
                width: LUTSIZE,
                height: 1
            };
        }
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
    group: "Synthesis",
    tags: ["noise", "perlin", "mixer", "simplex", "worley", "white", "synth", "webgl", "realtime"],
    description: "Generates highly-configurable noise. Offers a variety of blending " +
        "methods for application to images; also suitable as a standalone pattern " +
        "generator.",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        threshold: {min: 0, max: 0.45},
        cutoff: {min: 0.55, max: 1},
        zoneSX: {min: 0.4, max: 1},
        zoneSY: {min: 0.4, max: 1},
        zoneSoftness: {min: 0, max: 0.5}
    }
};

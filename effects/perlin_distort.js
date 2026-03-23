import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {blendControls, group} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";

const shaderPath = "perlin_distort.frag"
const includePaths = {
    'blend.glsl': "includes/blend.glsl",
    'colorconvert.glsl': "includes/colorconvert.glsl",
    'noise.glsl': "includes/noise.glsl",
    'classicnoise2D.glsl': "includes/noises/classicnoise2D.glsl",
    'cellular2D.glsl': "includes/noises/cellular2D.glsl",
    'noisenums.glsl': "includes/noises/noisenums.glsl",
};
const fragSource = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Perlin Distort",

    defaultConfig: {
        boundMode: "fract",
        pitchX: 0,
        pitchY: 0,
        freqX: 4,
        freqY: 4,
        seed: 1,
        depth: 0.5,
        rate: 4,
        rateDrive: 0,
        fc: [6, 15, 10],
        reps: [5, 5],
        phase: [0, 0],
        fuzz: 0,
        noiseMode: "pseudo",
        clampScale: 1,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        chromaBoost: 1,
        blendAmount: 1,
    },
    uiLayout: [
        group("Core Noise Settings", [
            {key: "seed", label: "Random Seed", type: "modSlider", min: 1, max: 500, step: 1},
            {key: "depth", label: "Noise Depth", type: "modSlider", min: 0, max: 1, step: 0.01},
            {
                key: "freqX",
                label: "Freq (X)",
                type: "modSlider",
                min: 0,
                max: 90,
                steps: 250,
                scale: "log",
                scaleFactor: 1.1
            },
            {
                key: "freqY",
                label: "Freq (Y)",
                type: "modSlider",
                min: 0,
                max: 90,
                steps: 250,
                scale: "log",
                scaleFactor: 1.1
            },
        ]),

        group("Grid Offset", [
            {key: "pitchX", label: "Grid Shift (X)", type: "modSlider", min: -2, max: 2, step: 0.01},
            {key: "pitchY", label: "Grid Shift (Y)", type: "modSlider", min: -2, max: 2, step: 0.01}
        ], {color: "#201000"}),

        group("Spatial Modulation", [
            {key: "rate", label: "Mod Freq", type: "modSlider", min: 0, max: 100, steps: 200, scale: "log"},
            {key: "rateDrive", label: "Mod Strength", type: "modSlider", min: 0, max: 1, step: 0.01},
            {
                key: "phase",
                label: "Modulation Phase",
                type: "vector",
                subLabels: () => ["X", "Y"],
                length: 2,
                min: 0,
                max: 1,
                step: 0.005
            },
            {key: "fuzz", label: "Fuzz", type: "Range", min: 0, max: 100, step: 0.01}
        ], {color: "#001020"}),

        group("Noise & Bounds", [
            {key: 'noiseMode', label: 'Noise Mode', type: 'Select', options: ['pseudo', 'classic', 'periodic']},
            {key: 'boundMode', label: 'Boundary Mode', type: 'Select', options: ['fract', 'free', 'clamp']},
            {
                key: "clampScale",
                label: "Clamp Scale",
                type: 'Range',
                min: 0,
                max: 3,
                step: 0.05,
                showIf: {key: "boundMode", equals: "clamp"}
            },
            {
                key: "fc",
                label: "Fade Coefficients",
                type: "vector",
                subLabels: () => ["C1", "C2", "C3"],
                length: 3,
                min: 1,
                max: 20,
                step: 1,
                showIf: {key: "noiseMode", equals: "pseudo"}
            },
            {
                key: "reps",
                label: "Repetitions",
                type: "vector",
                subLabels: () => ["X", "Y"],
                length: 2,
                min: 1,
                max: 20,
                step: 1,
                showIf: {key: "noiseMode", equals: "periodic"}
            }
        ]),
        blendControls()
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSource);
        const {
            pitchX, pitchY, freqX, freqY, phase,
            seed, depth, boundMode, rate, rateDrive, fuzz,
            noiseMode, clampScale, reps, fc, BLENDMODE, COLORSPACE,
            blendAmount, BLEND_CHANNEL_MODE, chromaBoost
        } = resolveAnimAll(instance.config, t);

        const boundCode = {'fract': 0, 'free': 1, 'clamp': 2}[boundMode];
        const modeCode = {'pseudo': 0, "classic": 1, "periodic": 2}[noiseMode];
        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_pitch: {value: [pitchX, pitchY], type: "vec2"},
            u_freq: {value: [freqX, freqY], type: "vec2"},
            u_seed: {value: seed, type: "float"},
            u_depth: {value: depth, type: "float"},
            u_rate: {value: rate, type: "float"},
            u_ratedrive: {value: rateDrive, type: "float"},
            u_phase: {value: phase, type: "vec2"},
            u_fuzz: {value: fuzz / 500, type: "float"},
            u_clampscale: {value: clampScale, type: "float"},
            u_reps: {value: reps, type: "vec2"},
            u_fc: {value: fc, type: "floatArray"},
            u_blendAmount: {value: blendAmount, type: "float"},
            u_chromaBoost: {value: chromaBoost, type: "float"},
        };
        const defines = {
            NOISEMODE: modeCode,
            BOUNDMODE: boundCode,
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE)
        };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSource.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
}

export const effectMeta = {
    group: "Distortion",
    tags: ["noise", "distortion", "webgl"],
    description: "Projects the image onto a surface generated from Perlin noise. "
        + "Creates organic-but-retro warps, curves, and plastic tumbler patterns.",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {depth: {min: 0.2, max: 1}, fuzz: {min: 0, max: 0}}
};

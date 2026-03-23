import {resolveAnimAll} from "../utils/animutils.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
    hasChromaBoostImplementation,
    makeEnum
} from "../utils/glsl_enums.js";
import {blendControls, group} from "../utils/ui_configs.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";

const shaderPath = "banded_flip.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: FlipColorEnum,
    names: FlipColorNames,
    options: FlipColorOpts
} = makeEnum([
    'RANDOM',
    'SWEEP',
    'TINT',
])

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Mirrorband",
    defaultConfig: {
        bandSize: 0.2,
        orientation: 1,
        mirrorRate: 1,
        offset: 0,
        noiseAmount: 0,
        colorNoise: 0,
        blendAmount: 1,
        COLORSPACE: ColorspaceEnum.RGB,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        chromaBoost: 1,
        seed: 0,
        levels: 1,
        rotationAmount: 0,
        sBias: 0.5,
        vBias: 0.5,
        hue: 0
    },
    uiLayout: [
        // **Geometry Controls**
        group("Band and Orientation", [
            {'type': 'modSlider', 'key': 'bandSize', 'label': 'Band Size', 'min': 0.01, 'max': 0.5, 'step': 0.01},
            {
                'type': 'select',
                'key': 'orientation',
                'label': 'Orientation',
                'options': [{'label': 'horizontal', 'value': 0}, {'label': 'vertical', 'value': 1}]
            }
        ]),

        group("Mirroring and Offsets", [
            {'type': 'modSlider', 'key': 'mirrorRate', 'label': 'Mirror Rate', 'min': 0, 'max': 1, 'step': 0.01},
            {'type': 'modSlider', 'key': 'offset', 'label': 'Offset', 'min': -1, 'max': 1, 'step': 0.01},
            {'type': 'modSlider', 'key': 'seed', 'label': 'Seed', 'min': 0, 'max': 500, 'step': 1}
        ]),

        group("Color Adjustments", [
            {'type': 'select', 'key': 'colorMode', 'label': 'Slab Color Mode', 'options': FlipColorOpts},
            {
                'type': 'select',
                'key': 'colorBlend',
                'label': 'Slab Color Blend',
                'options': [{'label': 'Soft', 'value': 0}, {'label': 'Hard', 'value': 1}]
            },
            {
                'type': 'modSlider',
                'key': 'hue',
                'label': 'H',
                'min': 0,
                'max': 1,
                'step': 0.01,
                'showIf': {key: "colorMode", equals: FlipColorEnum.TINT}
            },
            {'type': 'modSlider', 'key': 'sBias', 'label': 'S Bias', 'min': -0.5, 'max': 1, 'step': 0.01},
            {'type': 'modSlider', 'key': 'vBias', 'label': 'V Bias', 'min': 0, 'max': 1, 'step': 0.01}
        ]),

        group("Iteration", [
            {'type': 'modSlider', 'key': 'levels', 'label': 'Levels', 'min': 1, 'max': 5, 'step': 1},
            {'type': 'modSlider', 'key': 'rotationAmount', 'label': 'Rotation', 'min': 0, 'max': Math.PI, 'step': 0.01}
        ]),

        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            bandSize, orientation, mirrorRate, offset, seed,
            COLORSPACE, BLEND_CHANNEL_MODE, BLENDMODE, chromaBoost,
            blendAmount, levels, rotationAmount, hue, sBias, vBias, colorMode,
            colorBlend
        } = resolveAnimAll(instance.config, t);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {value: blendAmount, type: "float"},
            u_mirrorRate: {value: mirrorRate, type: "float"},
            u_seed: {value: seed, type: "float"},
            u_offset: {value: offset * (width + height) / 2, type: "float"},
            u_bandSize: {value: bandSize * (width + height) / 2, type: "float"},
            u_chromaBoost: {type: "float", value: chromaBoost},
            u_rotationAmount: {type: "float", value: rotationAmount},
            u_orientation: {type: "int", value: orientation},
            u_levels: {type: "int", value: levels},
            u_hue: {type: "float", value: hue},
            u_sBias: {type: "float", value: sBias},
            u_vBias: {type: "float", value: vBias},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            FLIP_COLOR_MODE: colorMode,
            FLIP_COLOR_BLEND: colorBlend
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
};

export const effectMeta = {
    group: "Distortion",
    tags: ["bands", "invert", "mirror", "rotation", "displacement"],
    description: "Alternates mirrored slices across the image, optionally rotating them into one another or recursively iterating the effect. Several color modes are supported.",
    canAnimate: true,
    realtimeSafe: true,
}

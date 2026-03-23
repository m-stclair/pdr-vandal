import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
    hasChromaBoostImplementation,
    makeEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "field_parentheses.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
    'color_projection.glsl': 'includes/color_projection.glsl',
    'basis_projection.glsl': 'includes/basis_projection.glsl',
    'vecfield.glsl': 'includes/vecfield.glsl'
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


export const {
    enum: FieldDisplayModeEnum,
    names: FieldDisplayModeNames,
    options: FieldDisplayModeOpts
} = makeEnum([
    'STRENGTH',
    'ATTENUATE',
    'TINT',
    'CHROMA_BOOST',
    'HILLSHADE',
    'EDGE',
]);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "field()",

    defaultConfig: {
        weights: [0, 0, 0, 0, 0, 1],
        FIELD_SIGNAL_COMPRESSION_KNEE: 0.75,
        FIELD_SIGNAL_NORMALIZE: false,

        FIELD_HUE_H: 0.0,
        FIELD_HUE_WIDTH: 0.3,
        FIELD_HUE_CHROMA_BOOST: 1.0,

        FIELD_CHROMA_EXP: 1.0,

        FIELD_LIGHT_CENTER: 0,
        FIELD_LIGHT_WIDTH: 0.25,

        FIELD_DOT_VECTOR: [1.0, 0.0, 0.0],

        FIELD_DISPLAY_MODE: FieldDisplayModeEnum.STRENGTH,

        blendAmount: 1,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        chromaBoost: 1,

        FIELD_TINT_COLOR: [0.6, 0.3, 0.2],
        FIELD_EDGE_CENTER: 0.5,
        FIELD_EDGE_WIDTH: 0.1,
        FIELD_CHROMA_BOOST_MULT: 2,
        FIELD_LIGHT_DIR: [0.25, 0.75],
        FIELD_LIGHT_Z: 1.5,

        FIELD_HUE1_CENTER: 0.2,
        FIELD_HUE1_WIDTH: 0.1,
        FIELD_HUE2_CENTER: 0.8,
        FIELD_HUE2_WIDTH: 0.1,
        FIELD_HUE_GRAD_CHROMA_GAMMA: 1
    },


    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            FIELD_HUE_H,
            FIELD_HUE_WIDTH,
            FIELD_HUE_CHROMA_BOOST,
            FIELD_CHROMA_EXP,
            FIELD_LIGHT_CENTER,
            FIELD_LIGHT_WIDTH,
            FIELD_DOT_VECTOR,
            FIELD_DISPLAY_MODE,
            weights,
            COLORSPACE,
            BLENDMODE,
            BLEND_CHANNEL_MODE,
            blendAmount,
            FIELD_SIGNAL_COMPRESSION_KNEE,
            FIELD_SIGNAL_NORMALIZE,
            FIELD_TINT_COLOR,
            FIELD_EDGE_CENTER,
            FIELD_EDGE_WIDTH,
            FIELD_CHROMA_BOOST_MULT,
            FIELD_LIGHT_DIR,
            FIELD_LIGHT_Z,
            FIELD_HUE1_CENTER,
            FIELD_HUE1_WIDTH,
            FIELD_HUE2_CENTER,
            FIELD_HUE2_WIDTH,
            FIELD_HUE_GRAD_CHROMA_GAMMA,
            chromaBoost
        } = resolveAnimAll(config, t);
        const [hw, cw, lw, dw, hfw, hgw, hcw] = weights;
        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {type: "float", value: blendAmount},
            u_chromaBoost: {type: "float", value: chromaBoost},
            u_FIELD_HUE_WEIGHT: {type: "float", value: hw},
            u_FIELD_HUE_H: {type: "float", value: FIELD_HUE_H / (2 * Math.PI)},
            u_FIELD_HUE_WIDTH: {type: "float", value: FIELD_HUE_WIDTH},
            u_FIELD_HUE_CHROMA_BOOST: {type: "float", value: FIELD_HUE_CHROMA_BOOST},
            u_FIELD_CHROMA_WEIGHT: {type: "float", value: cw},
            u_FIELD_CHROMA_EXP: {type: "float", value: FIELD_CHROMA_EXP},
            u_FIELD_LIGHT_WEIGHT: {type: "float", value: lw},
            u_FIELD_LIGHT_CENTER: {type: "float", value: FIELD_LIGHT_CENTER},
            u_FIELD_LIGHT_WIDTH: {type: "float", value: FIELD_LIGHT_WIDTH},
            u_FIELD_DOT_WEIGHT: {type: "float", value: dw},
            u_FIELD_DOT_VECTOR: {type: "vec3", value: FIELD_DOT_VECTOR},
            u_FIELD_HUE_FILTER_WEIGHT: {type: "float", value: hfw},
            u_FIELD_TINT_COLOR: {type: "vec3", value: FIELD_TINT_COLOR},
            u_FIELD_EDGE_CENTER: {type: "float", value: FIELD_EDGE_CENTER},
            u_FIELD_EDGE_WIDTH: {type: "float", value: FIELD_EDGE_WIDTH},
            u_FIELD_CHROMA_BOOST_MULT: {type: "float", value: FIELD_CHROMA_BOOST_MULT},
            u_FIELD_SIGNAL_COMPRESSION_KNEE: {type: "float", value: FIELD_SIGNAL_COMPRESSION_KNEE},
            u_FIELD_LIGHT_DIR: {type: "vec2", value: FIELD_LIGHT_DIR},
            u_FIELD_LIGHT_Z: {type: "float", value: FIELD_LIGHT_Z},
            u_FIELD_HUE1_CENTER: {type: "float", value: FIELD_HUE1_CENTER},
            u_FIELD_HUE1_WIDTH: {type: "float", value: FIELD_HUE1_WIDTH},
            u_FIELD_HUE2_CENTER: {type: "float", value: FIELD_HUE2_CENTER},
            u_FIELD_HUE2_WIDTH: {type: "float", value: FIELD_HUE2_WIDTH},
            u_FIELD_HUE_GRAD_WEIGHT: {type: "float", value: hgw},
            u_FIELD_HUE_GRAD_CHROMA_GAMMA: {type: "float", value: FIELD_HUE_GRAD_CHROMA_GAMMA},
        };
        const defines = {
            FIELD_DISPLAY_MODE: FIELD_DISPLAY_MODE,
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            FIELD_SIGNAL_NORMALIZE: Number(FIELD_SIGNAL_NORMALIZE),
        }
        instance.glState.renderGL(inputTex, outputFBO, uniforms, defines);
    },
    uiLayout: [
        {
            type: 'group',
            label: "Mixer",
            kind: "collapse",
            collapsed: false,
            children: [
                {
                    type: "vector",
                    key: "weights",
                    label: "",
                    subLabels: ["Hue", "Chroma", "Luma Band", "Direction",
                        "Hue Filter", "Hue Gradient"],
                    min: -1,
                    max: 2,
                    step: 0.01
                },
                {
                    type: "checkbox",
                    label: "Normalize",
                    key: "FIELD_SIGNAL_NORMALIZE"
                },
                {
                    type: "modSlider",
                    key: "FIELD_SIGNAL_COMPRESSION_KNEE",
                    label: "Knee",
                    min: 0.01,
                    max: 1.0,
                    steps: 200
                }
            ]
        },
        {
            type: 'group',
            label: 'Display Parameters',
            kind: 'collapse',
            collapsed: false,
            children: [
                {
                    type: "select",
                    label: "Display Mode",
                    options: FieldDisplayModeOpts,
                    key: "FIELD_DISPLAY_MODE"
                },
                {
                    type: "modSlider",
                    showIf: {key: "FIELD_DISPLAY_MODE", equals: FieldDisplayModeEnum.CHROMA_BOOST},
                    key: "FIELD_CHROMA_BOOST_MULT",
                    label: "Mult",
                    min: 0.5,
                    max: 3.0,
                    steps: 200
                },
                {
                    type: "vector",
                    length: 3,
                    key: "FIELD_TINT_COLOR",
                    subLabels: ["R", "G", "B"],
                    label: "Tint Color",
                    min: 0,
                    max: 1,
                    step: 0.01,
                    showIf: {key: "FIELD_DISPLAY_MODE", equals: FieldDisplayModeEnum.TINT},

                },
                {
                    type: "modSlider",
                    key: "FIELD_EDGE_CENTER",
                    label: "Band Center",
                    min: 0,
                    max: 1,
                    steps: 200,
                    showIf: {key: "FIELD_DISPLAY_MODE", equals: FieldDisplayModeEnum.EDGE},
                },
                {
                    type: "modSlider",
                    key: "FIELD_EDGE_WIDTH",
                    label: "Bandwidth",
                    min: 0.001,
                    max: 0.5,
                    steps: 200,
                    showIf: {key: "FIELD_DISPLAY_MODE", equals: FieldDisplayModeEnum.EDGE},
                },
                {
                    type: "vector",
                    key: "FIELD_LIGHT_DIR",
                    label: "Light XY",
                    subLabels: ["X", "Y"],
                    length: 2,
                    min: -1,
                    max: 1,
                    step: 0.01,
                    showIf: {key: "FIELD_DISPLAY_MODE", equals: FieldDisplayModeEnum.HILLSHADE}

                },
                {
                    type: "modSlider",
                    key: "FIELD_LIGHT_Z",
                    label: "Z (Up)",
                    min: 0.01,
                    max: 3.0,
                    steps: 200,
                    showIf: {key: "FIELD_DISPLAY_MODE", equals: FieldDisplayModeEnum.HILLSHADE}
                },
                {
                    type: "modSlider",
                    key: "FIELD_LIGHT_Z",
                    label: "Z (Up)",
                    min: 0.01,
                    max: 3.0,
                    steps: 200,
                    showIf: {key: "FIELD_DISPLAY_MODE", equals: FieldDisplayModeEnum.HILLSHADE}
                }
            ],
        },
        {
            type: 'group', label: 'Component Controls', kind: 'collapse', children: [
                {
                    type: 'group',
                    label: 'Hue Affinity',
                    kind: 'collapse',
                    children: [
                        {
                            type: "modSlider",
                            key: "FIELD_HUE_H",
                            label: "Target Hue (rad)",
                            min: 0,
                            max: 6.283,
                            steps: 200
                        },
                        {
                            type: "modSlider",
                            key: "FIELD_HUE_WIDTH",
                            label: "Hue Width",
                            min: 0.01,
                            max: 3.14,
                            steps: 200
                        },
                        {
                            type: "modSlider",
                            key: "FIELD_HUE_CHROMA_BOOST",
                            label: "Gamma",
                            min: 0,
                            max: 2,
                            steps: 200,
                            scale: "log"
                        }
                    ]
                },
                {
                    type: 'group',
                    label: 'Hue Filter',
                    kind: 'collapse',
                    children: [
                        {type: "modSlider", key: "FIELD_HUE1_CENTER", label: "Hue 1", min: 0, max: 1, steps: 200},
                        {type: "modSlider", key: "FIELD_HUE1_WIDTH", label: "Hue 1 W", min: 0.01, max: 0.5, steps: 200},

                        {type: "modSlider", key: "FIELD_HUE2_CENTER", label: "Hue 2", min: 0, max: 1, steps: 200},
                        {type: "modSlider", key: "FIELD_HUE2_WIDTH", label: "Hue 2 W", min: 0.01, max: 0.5, steps: 200}
                    ]
                },
                {
                    type: 'group',
                    label: 'Chroma',
                    kind: 'collapse',
                    children: [
                        {type: "modSlider", key: "FIELD_CHROMA_EXP", label: "Gamma", min: 0.1, max: 5, steps: 200}
                    ]
                },
                {
                    type: 'group',
                    label: 'Luma Band',
                    kind: 'collapse',
                    children: [
                        {type: "modSlider", key: "FIELD_LIGHT_CENTER", label: "Center L", min: 0, max: 1, steps: 200},
                        {type: "modSlider", key: "FIELD_LIGHT_WIDTH", label: "Width L", min: 0.01, max: 1, steps: 200}
                    ]
                },
                {
                    type: 'group',
                    label: 'Hue Gradient',
                    kind: 'collapse',
                    children: [
                        {
                            type: 'modSlider',
                            key: 'FIELD_HUE_GRAD_CHROMA_GAMMA',
                            label: 'Gamma',
                            min: 0.1,
                            max: 4,
                            steps: 200,
                            scale: "log"
                        },
                    ]
                },
                {
                    type: 'group',
                    label: 'LCH Dot',
                    kind: 'collapse',
                    children: [
                        {
                            type: "vector",
                            key: "FIELD_DOT_VECTOR",
                            label: "Dot Vector",
                            length: 3,
                            subLabels: ["L", "C", "H"],
                            min: -1,
                            max: 1,
                            step: 0.01
                        }
                    ]
                },
            ]
        },
        blendControls()
    ],

    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    initHook: fragSources.load,
    glState: null,
    isGPU: true
}

export const effectMeta = {
    group: "Operators",
    tags: ["color", "mix"],
    description: "Sculpts perceptual field functions across color dimensions, " +
        "then turns them into structure. Modulation, contour, displacement, " +
        "pseudo-lighting. Visual property extractor.",
    canAnimate: true,
    realtimeSafe: true,
};


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

const shaderPath = "halftone.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: HalftoneEnum,
    names: HalftoneNames,
    options: HalftoneOpts
} = makeEnum([
    'HALFTONE_BLACK', 'HALFTONE_CMYK'
])

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Halftone",
    defaultConfig: {
        blendAmount: 1,
        COLORSPACE: ColorspaceEnum.RGB,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        halftoneMode: HalftoneEnum.HALFTONE_BLACK,
        chromaBoost: 1,
        cellSize: 5,
        blackAngle: 0,
        cAngle: 15,
        mAngle: 75,
        yAngle: 0,
        kAngle: 45,
        cOffset: 5,
        mOffset: 5,
        yOffset: 5,
        kOffset: 5,
    },
    uiLayout: [
        {type: 'select', key: 'HALFTONE_MODE', label: 'Halftone Mode', options: HalftoneOpts},
        {'type': 'modSlider', 'key': 'cellSize', 'label': 'Cell Size', 'min': 2, 'max': 20, 'step': 1},
        {
            'type': 'modSlider', 'key': 'blackAngle', 'label': 'Angle', 'min': 0, 'max': 359, 'step': 1,
            showIf: {key: "HALFTONE_MODE", notEquals: HalftoneEnum.HALFTONE_CMYK}
        },
        {
            type: 'group',
            label: 'CMYK Plate Params',
            kind: 'collapse',
            showIf: {key: 'HALFTONE_MODE', equals: HalftoneEnum.HALFTONE_CMYK},
            children: [
                {'type': 'modSlider', 'key': 'cAngle', 'label': 'Cyan Angle', 'min': 0, 'max': 359, 'step': 1},
                {'type': 'modSlider', 'key': 'mAngle', 'label': 'Magenta Angle', 'min': 0, 'max': 359, 'step': 1},
                {'type': 'modSlider', 'key': 'yAngle', 'label': 'Yellow Angle', 'min': 0, 'max': 359, 'step': 1},
                {'type': 'modSlider', 'key': 'kAngle', 'label': 'Black Angle', 'min': 0, 'max': 359, 'step': 1},
                {'type': 'modSlider', 'key': 'cOffset', 'label': 'Cyan Offset', 'min': 0, 'max': 20, 'step': 1},
                {'type': 'modSlider', 'key': 'mOffset', 'label': 'Magenta Offset', 'min': 0, 'max': 20, 'step': 1},
                {'type': 'modSlider', 'key': 'yOffset', 'label': 'Yellow Offset', 'min': 0, 'max': 20, 'step': 1},
                {'type': 'modSlider', 'key': 'kOffset', 'label': 'Black Offset', 'min': 0, 'max': 20, 'step': 1},
            ]
        },

        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            cellSize, blackAngle, cAngle, mAngle, yAngle, kAngle,
            cOffset, mOffset, yOffset, kOffset, HALFTONE_MODE,
            blendAmount, COLORSPACE, BLEND_CHANNEL_MODE, BLENDMODE, chromaBoost,
        } = resolveAnimAll(instance.config, t);
        const uniformSpec = {
            u_cellsize: {type: "float", value: cellSize},
            u_blackAngle: {type: "float", value: blackAngle * Math.PI / 180},
            u_cAngle: {type: "float", value: cAngle * Math.PI / 180},
            u_mAngle: {type: "float", value: mAngle * Math.PI / 180},
            u_yAngle: {type: "float", value: yAngle * Math.PI / 180},
            u_kAngle: {type: "float", value: kAngle * Math.PI / 180},
            u_cOffset: {type: "float", value: cOffset},
            u_mOffset: {type: "float", value: mOffset},
            u_yOffset: {type: "float", value: yOffset},
            u_kOffset: {type: "float", value: kOffset},
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {type: "float", value: blendAmount},
            u_chromaBoost: {type: "float", value: chromaBoost},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            HALFTONE_MODE: HALFTONE_MODE
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
    group: "Stylize",
    tags: ["print", "pattern", "analog", "poster"],
    description: (
        "Halftone print effect with simple black and CMYK options."
    ),
    canAnimate: true,
    realtimeSafe: true,
}

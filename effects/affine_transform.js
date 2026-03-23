import {deg2rad, rotationMatrix2D, shearMatrix2D, scaleMatrix2D, multiplyMat2} from "../utils/mathutils.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "affine_transform.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Affine Transform",

    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        blendAmount: 1,
        chromaBoost: 1,
        angle: 0,
        shearX: 0,
        shearY: 0,
        scaleX: 1,
        scaleY: 1,
        translateX: 0,
        translateY: 0,
        wrap: false,

    },

    uiLayout: [
        {key: "angle", label: "Rotate (°)", type: "modSlider", min: -180, max: 180},
        {
            key: "scaleX",
            label: "Scale X",
            type: "modSlider",
            min: 0.1,
            max: 10,
            step: 0.05,
            scale: "log",
            scaleFactor: 3
        },
        {
            key: "scaleY",
            label: "Scale Y",
            type: "modSlider",
            min: 0.1,
            max: 10,
            step: 0.05,
            scale: "log",
            scaleFactor: 3
        },
        {key: "shearX", label: "Shear X", type: "modSlider", min: -3, max: 3, step: 0.02},
        {key: "shearY", label: "Shear Y", type: "modSlider", min: -3, max: 3, step: 0.02},
        {key: "translateX", label: "Translate X", type: "modSlider", min: -1, max: 1, step: 0.01},
        {key: "translateY", label: "Translate Y", type: "modSlider", min: -1, max: 1, step: 0.01},
        {key: "wrap", label: "Wrap", type: "checkbox"},
        blendControls()
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            angle,
            shearX,
            shearY,
            scaleX,
            scaleY,
            translateX,
            translateY,
            wrap,
            blendAmount,
            COLORSPACE,
            BLENDMODE,
            chromaBoost,
            BLEND_CHANNEL_MODE
        } = resolveAnimAll(instance.config, t);

        const rot = rotationMatrix2D(deg2rad(angle));
        const shear = shearMatrix2D(shearX, shearY);
        const scale = scaleMatrix2D(scaleX, scaleY);
        const affine = multiplyMat2(rot, multiplyMat2(shear, scale));

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_affine: {value: affine, type: "mat2"},
            u_offset: {value: [translateX, translateY], type: "vec2"},
            u_wrap: {value: wrap, type: "bool"},
            u_chromaBoost: {value: chromaBoost, type: "float"},
            u_blendamount: {type: "float", value: blendAmount},
        }
        const defines = {
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
}

export const effectMeta = {
    group: "Geometry",
    tags: ["webgl", "geometry", "zoom", "shift", "crop", "rotate", "transform", "realtime"],
    description: "Zoom, rotate, spin, shear, shift, squeeze, crop, stretch, etc.",
    canAnimate: true,
    realtimeSafe: true,
}

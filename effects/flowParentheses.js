import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, hasChromaBoostImplementation,
    makeEnum,
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";
import {generate2DKernel, KernelTypeEnum, subsampleKernel2D} from "../utils/kernels.js";

const shaderPath = "flow_parentheses.glsl"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: PChannelEnum,
    names: PChannelNames,
    options: PChannelOpts
} = makeEnum([
    'LUMA',
    'R',
    'G',
    'B',
    "H",
    "S"
]);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "flow()",
    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        blendAmount: 1,
        warpStrength: 0.2,
        directionStrength: 0.5,
        directionChannel: PChannelEnum.S,
        magChannel: PChannelEnum.LUMA,
        directionPolarity: false,
        magPolarity: false,
        threshLow: 0,
        threshHigh: 1,
        magGamma: 1,
        kernelName: "gaussian",
        kernelRadiusX: 3,
        kernelRadiusY: 3,
        kernelSoftness: 10,
        chromaBoost: 1

    },
    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            collapsed: false,
            label: "Base Warp Parameters",
            children: [
                {key: "warpStrength", label: "Warp Strength", type: "modSlider", min: -5, max: 5, steps: 200},
                {key: "threshLow", label: "Threshold Low", type: "modSlider", min: 0, max: 1, steps: 200},
                {key: "threshHigh", label: "Threshold High", type: "modSlider", min: 0, max: 1, steps: 200},
                {key: "magGamma", label: "Warp Gamma", type: "modSlider", min: 0.01, max: 8, scale: "log", steps: 200},
                {
                    type: "select",
                    key: "magChannel",
                    label: "Warp Channel",
                    options: PChannelOpts
                },
                {
                    type: "checkbox",
                    key: "magPolarity",
                    label: "Flip Warp Polarity"
                },
            ]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Direction",
            children: [
                {
                    key: "directionStrength",
                    label: "Direction Strength",
                    type: "modSlider",
                    min: 0,
                    max: 20,
                    steps: 250,
                    scale: "log"
                },
                {
                    type: "select",
                    key: "directionChannel",
                    label: "Direction Channel",
                    options: PChannelOpts
                },
                {
                    type: "checkbox",
                    key: "directionPolarity",
                    label: "Direction Polarity",
                },

            ]
        },
        {
            type: "group",
            label: "Kernel",
            kind: "collapse",
            children: [
                {type: "range", key: "kernelRadiusX", label: "Radius X", min: 1, max: 30, step: 1},
                {type: "range", key: "kernelRadiusY", label: "Radius Y", min: 1, max: 30, step: 1},
                {type: "modSlider", key: "kernelSoftness", label: "Softness", min: 1, max: 20, steps: 200},
                {
                    key: 'kernelName',
                    label: 'Kernel Shape',
                    type: 'Select',
                    options: Object.values(KernelTypeEnum)
                },
            ]
        },
        blendControls(),
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources)
        const {
            BLENDMODE, COLORSPACE, blendAmount,
            BLEND_CHANNEL_MODE, magChannel,
            directionChannel, warpStrength,
            magPolarity, threshLow, threshHigh, magGamma,
            directionStrength,
            kernelName, kernelRadiusX, kernelRadiusY,
            kernelSoftness, chromaBoost
        } = resolveAnimAll(instance.config, t);
        let kernelInfo;
        const kernelSettings = [kernelName, kernelRadiusX, kernelRadiusY, kernelSoftness];
        if (String(instance.auxiliaryCache.lastKernelSettings) !== String(kernelSettings)) {
            const MAX_KERNEL_SIZE = 255;
            kernelInfo = generate2DKernel(kernelName, kernelRadiusX, kernelRadiusY, kernelSoftness);
            if (kernelInfo.kernel.length > MAX_KERNEL_SIZE) {
                kernelInfo = subsampleKernel2D(kernelInfo.kernel, kernelInfo.width, kernelInfo.height, MAX_KERNEL_SIZE);
            }
            instance.auxiliaryCache.lastKernelSettings = kernelSettings;
            instance.auxiliaryCache.kernelInfo = kernelInfo;
        } else {
            kernelInfo = instance.auxiliaryCache.kernelInfo;
        }
        instance.auxiliaryCache.lastKernelSettings = kernelSettings;
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_warpStrength: {type: "float", value: warpStrength},
            u_threshLow: {type: "float", value: threshLow},
            u_threshHigh: {type: "float", value: threshHigh},
            u_directionStrength: {type: "float", value: directionStrength},
            u_directionChannel: {type: "int", value: directionChannel},
            u_directionPolarity: {type: "float", value: Number(magPolarity)},
            u_magnitudeChannel: {type: "int", value: magChannel},
            u_magnitudePolarity: {type: "float", value: Number(magPolarity)},
            u_magnitudeGamma: {type: "float", value: magGamma},
            u_blendamount: {value: blendAmount, type: "float"},
            u_kernel: {type: "floatArray", value: kernelInfo.kernel},
            u_kernelWidth: {type: "int", value: kernelInfo.width},
            u_kernelHeight: {type: "int", value: kernelInfo.height},
            u_chromaBoost: {type: "float", value: chromaBoost},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            KERNEL_SIZE: kernelInfo.kernel.length,
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: async (instance, renderer) => {
        instance.auxiliaryCache = {};
        await fragSources.load(instance, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
};
export const effectMeta = {
    group: "Operators",
    tags: ["sort", "webgl", "blur", "paint"],
    description: "Ink in water, hourglass sandlight, dissection, pixel clouds. " +
        "Applies a spatial displacement field to an image, with rotation and magnitude " +
        "separately modulated by luma, hue, saturation, or specified color channels. ",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        threshHigh: {min: 0.55, max: 1},
        threshLow: {min: 0, max: 0.5},
        warpStrength: {min: 0.2, max: 1},
        kernelRadiusX: {min: 2, max: 9},
        kernelRadiusY: {min: 2, max: 9}
    }
};

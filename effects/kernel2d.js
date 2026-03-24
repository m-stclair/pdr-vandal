import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum,
    hasChromaBoostImplementation,
} from "../utils/glsl_enums.js";
import {generate2DKernel, KernelTypeEnum, subsampleKernel2D} from "../utils/kernels.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "kernel2d.glsl";
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "2D Kernel",
    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        blendAmount: 1,
        chromaBoost: 1,
        kernelName: "gaussian",
        kernelRadiusX: 3,
        kernelRadiusY: 3,
        kernelSoftness: 10
    },
    uiLayout: [
        {
            key: 'kernelName',
            label: 'Kernel Shape',
            type: 'Select',
            options: Object.values(KernelTypeEnum)
        },
        {type: "range", key: "kernelRadiusX", label: "Radius X", min: 1, max: 30, step: 1},
        {type: "range", key: "kernelRadiusY", label: "Radius Y", min: 1, max: 30, step: 1},
        {type: "modSlider", key: "kernelSoftness", label: "Softness", min: 1, max: 20, steps: 200},
        blendControls()
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        let {
            kernelName, kernelRadiusX, kernelRadiusY, kernelSoftness,
            BLENDMODE, COLORSPACE, BLEND_CHANNEL_MODE, blendAmount,
            chromaBoost
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
        u_kernel: {type: "floatArray", value: kernelInfo.kernel},
        u_kernelWidth: {type: "int", value: kernelInfo.width},
        u_kernelHeight: {type: "int", value: kernelInfo.height},
        u_blendamount: {type: "float", value: blendAmount},
        u_chromaBoost: {type: "float", value: chromaBoost}
    };

        const defines = {
            KERNEL_SIZE: kernelInfo.kernel.length,
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE
        };
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
    group: "Utility",
    tags: ["kernel", "blur", "sharpen", "emboss", "webgl", "filter", "convolution"],
    description: "Applies a generic 2D convolution kernel; use for blur, emboss, sharpening, etc.",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        blendAmount: {min: 0.75, max: 1},
        kernelRadiusX: {min: 2, max: 9},
        kernelRadiusY: {min: 2, max: 9}
    }
};

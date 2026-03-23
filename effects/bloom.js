import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, hasChromaBoostImplementation
} from "../utils/glsl_enums.js";
import {generateKernel, KernelTypeEnum} from "../utils/kernels.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "bloom.glsl"
const includePaths = {
    'kernel_utils.glsl': 'includes/kernel_utils.glsl',
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Bloom",
    defaultConfig: {
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        blendAmount: 1,
        bloomThreshold: 0.4,
        bloomSoftness: 0.3,
        bloomStrength: 0.4,
        kernelName: "gaussian",
        kernelRadius: 3,
        kernelSoftness: 10,
        BLOOM_MODE: 0,
        BLOOM_CHROMA_TAIL: false,
        chromaOffset: [1.1, 1.0, 0.9],
        chromaBoost: 1
    },
    uiLayout: [
        {
            type: 'group',
            label: 'Bloom Thresholding',
            kind: 'collapse',
            color: '#1a0020',
            children: [
                {type: "modSlider", key: "bloomThreshold", label: "Thresh", min: 0, max: 1, steps: 200},
                {type: "modSlider", key: "bloomSoftness", label: "Soft", min: 0, max: 1, steps: 200},
                {type: "modSlider", key: "bloomStrength", label: "Strength", min: 0, max: 3, steps: 200},
            ]
        },
        {
            type: 'group',
            label: 'Kernel Settings',
            kind: 'collapse',
            color: '#001a1a',
            children: [
                {
                    key: 'kernelName',
                    label: 'Kernel Type',
                    type: 'Select',
                    options: Object.values(KernelTypeEnum)
                },
                {type: "range", key: "kernelRadius", label: "Radius", min: 3, max: 30, step: 1},
                {type: "modSlider", key: "kernelSoftness", label: "Softness", min: 1, max: 20, steps: 200},
            ]
        },
        {
            key: 'BLOOM_MODE',
            label: 'Bloom Mode',
            type: 'Select',
            options: [{'label': 'Luma', 'value': 0}, {'label': "Saturation", "value": 1}]
        },
        {
            type: 'group',
            label: 'Chroma Tail Settings',
            kind: 'collapse',
            color: '#1a002a',
            showIf: {'key': 'BLOOM_CHROMA_TAIL', 'equals': true},
            children: [
                {
                    key: "chromaOffset",
                    label: "Chroma Tail Shape",
                    type: "vector",
                    length: 3,
                    subLabels: ["R", "G", "B"],
                    min: -10,
                    max: 10,
                    step: 0.01
                }
            ]
        },
        {
            key: 'BLOOM_CHROMA_TAIL',
            label: 'Enable Chroma Tail',
            type: 'Checkbox',
        },
        blendControls()
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        let {
            BLENDMODE, COLORSPACE, blendAmount, BLEND_CHANNEL_MODE, bloomStrength,
            bloomThreshold, bloomSoftness, BLOOM_MODE, kernelRadius,
            chromaOffset, BLOOM_CHROMA_TAIL, kernelName, kernelSoftness,
            chromaBoost
        } = resolveAnimAll(instance.config, t);
        const kernel = generateKernel(kernelName, kernelRadius, kernelSoftness);
        // console.log(kernel);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {value: blendAmount, type: "float"},
            u_bloomSoftness: {value: bloomSoftness, type: "float"},
            u_bloomStrength: {value: bloomStrength, type: "float"},
            u_bloomThreshold: {value: bloomThreshold, type: "float"},
            u_kernel: {value: kernel, type: "floatArray"},
            u_chromaOffset: {value: chromaOffset, type: "vec3"},
            u_chromaBoost: {type: "float", value: chromaBoost}
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            KERNEL_SIZE: kernel.length,
            BLOOM_MODE: BLOOM_MODE,
            BLOOM_CHROMA_TAIL: Number(BLOOM_CHROMA_TAIL)
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
};

export const effectMeta = {
    group: "Stylize",
    tags: ["light", "bloom", "webgl", "lens", "light", "flare", "cinematic"],
    description: "Bloom / flare effect offering a variety of selectable modes and shapes",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {bloomThreshold: {min: 0, max: 0.65}}
};

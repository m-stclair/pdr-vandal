import {
    boxKernel,
    circularKernel,
    annularKernel,
    normalizeWeights,
    centerKernel
} from "../utils/delay_kernels.js";
import {deg2rad, multiplyMat2, rotationMatrix2D, scaleMatrix2D, shearMatrix2D} from "../utils/mathutils.js";
import {MAX_TAPS} from "../utils/gl_config.js";
import {weightFns} from "../utils/weightings.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {blendControls, group} from "../utils/ui_configs.js";
import {hasChromaBoostImplementation} from "../utils/glsl_enums.js";

const shaderPath = "delayline.frag"
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl"
};
const fragSource = loadFragSrcInit(shaderPath, includePaths);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Delay Line",

    defaultConfig: {
        delay: 32,
        window: "box",
        falloff: "uniform",
        density: 2,
        angle: 0,
        shearX: 0,
        shearY: 0,
        scaleX: 1,
        scaleY: 1,
        COLORSPACE: 0,
        BLENDMODE: 1,
        blendAmount: 1,
        blendTarget: '0',
        jitter: 0,
        chromaBoost: 1,
        BLEND_CHANNEL_MODE: 0
    },

    uiLayout: [
        // Core Controls
        {
            key: "delay",
            label: "Delay (px)",
            type: "modSlider",
            min: 0,
            max: 200
        },
        {
            key: "density",
            label: "Tap Density",
            type: "modSlider",
            min: 1,
            max: 8,
            step: 0.1
        },

        // Kernel Shape Group
        group("Kernel Shape", [
            {
                type: "select",
                key: "window",
                label: "Window",
                options: [
                    {value: "box", label: "Box"},
                    {value: "circle", label: "Circle"},
                    {value: "ring", label: "Ring"},
                ]
            },
            {
                key: "falloff",
                label: "Falloff",
                type: "select",
                options: Object.keys(weightFns)
            },
            {
                key: "jitter",
                label: "Jitter",
                type: "modSlider",
                min: 0,
                max: 1,
                step: 0.01
            }
        ], {color: "#1a0000"}),

        // Spatial Transform Group
        group("Spatial Transform", [
            {key: "angle", label: "Angle", type: "modSlider", min: -180, max: 180},
            {key: "shearX", label: "Shear (x)", type: "modSlider", min: -5, max: 5, step: 0.1},
            {key: "shearY", label: "Shear (y)", type: "modSlider", min: -5, max: 5, step: 0.1},
            {key: "scaleX", label: "Scale (x)", type: "modSlider", min: 0.1, max: 3, step: 0.1},
            {key: "scaleY", label: "Scale (y)", type: "modSlider", min: 0.1, max: 3, step: 0.1}
        ], {color: "#001a00"}),

        blendControls()
    ],


    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSource);
        const {
            delay, window, density, angle, falloff, shearX, shearY,
            scaleX, scaleY, blendAmount, BLENDMODE, BLEND_CHANNEL_MODE, COLORSPACE,
            jitter, chromaBoost
        } = resolveAnimAll(instance.config, t);
        // TODO: write equivalent quit-fast option for GL
        // if (delay <= 0) return data;
        let kernelFn;
        let shapeArgs = [delay];
        if (window === "circle") {
            kernelFn = circularKernel;
        } else if (window === "ring") {
            kernelFn = annularKernel;
            shapeArgs = [delay * 0.5, delay];
        } else {
            kernelFn = boxKernel;
        }
        let {taps, weights} = kernelFn(
            ...shapeArgs,
            {
                spacing: delay / density,
                maxTaps: MAX_TAPS,
                weightFn: weightFns[falloff],
            }
        );
        weights = normalizeWeights(weights);
        taps = centerKernel(taps);
        let [maxX, maxY, minX, minY] = [-Infinity, -Infinity, Infinity, Infinity];
        for (let [x, y] of taps) {
            maxX = maxX < x ? x : maxX;
            minX = minX > x ? x : minX;
            maxY = maxY < y ? y : maxY;
            minY = minY > y ? y : minY;
        }
        for (let i = 0; i < taps.length; i++) {
            const shiftX = Math.round(
                (Math.random() - 0.5) * jitter * (maxX - minX) / taps.length
            );
            const shiftY = Math.round(
                (Math.random() - 0.5) * jitter * (maxY - minY) / taps.length
            );
            taps[i] = [taps[i][0] + shiftX, taps[i][1] + shiftY];
        }
        // TODO: is there any reason not to just apply the affine transform here
        const rot = rotationMatrix2D(deg2rad(angle));
        const shear = shearMatrix2D(shearX, shearY);
        const scale = scaleMatrix2D(scaleX, scaleY);
        const affine = multiplyMat2(rot, multiplyMat2(shear, scale));

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_numTaps: {value: taps.length, type: "int"},
            u_offsets: {value: new Float32Array(taps.flat()), type: "vec2"},
            u_weights: {value: new Float32Array(weights), type: "floatArray"},
            u_transformMatrix: {value: affine, type: "mat2"},
            u_blendamount: {value: blendAmount, type: "float"},
            u_chromaBoost: {value: chromaBoost, type: "float"}
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE
        }

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
    group: "Geometry",
    tags: ["blur", "delay", "temporal", "webgl", "kernel", "animated"],
    description: "Applies a multi-sample spatial delay using a configurable kernel on GPU. " +
        "Capable of motion blur, kaleidoscoping, and echoic distortion.",
    canAnimate: true,
    realtimeSafe: true,
};

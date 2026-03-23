import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {makeEnum} from "../utils/glsl_enums.js";

const shaderPath = "slamshade.frag";
const includePaths = {};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: MetricEnum,
    names: MetricNames,
    options: MetricOpts
} = makeEnum([
    'MIN',
    'MANHATTAN',
    'EUCLIDEAN',
    'CHEBYSHEV'
])


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Differential Shader",

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            rawAmount, slopeAmount, hillAmount, slamAmount,
            METRIC_ORD, outScale, hillDir
        } = resolveAnimAll(instance.config, t);

        const hillDirRad = Math.PI * hillDir / 180;
        const hillDirVec = [Math.sin(hillDirRad), Math.cos(hillDirRad)]
        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            u_rawAmount: {value: rawAmount, type: "float"},
            u_slopeAmount: {value: slopeAmount, type: "float"},
            u_hillAmount: {value: hillAmount, type: "float"},
            u_slamAmount: {value: slamAmount, type: "float"},
            u_outScale: {value: outScale, type: "float"},
            u_hillDir: {value: hillDirVec, type: "vec2"}
        }
        const defines = {
            METRIC_ORD: METRIC_ORD
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
    defaultConfig: {
        rawAmount: 0.25,
        slopeAmount: 0.5,
        hillAmount: 0.0,
        slamAmount: 0.25,
        hillDir: 90,
        outScale: 1,
        METRIC_ORD: MetricEnum.EUCLIDEAN
    },
    uiLayout: [
        {
            key: "rawAmount",
            label: "Raw Amount",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: "slopeAmount",
            label: "Slope Amount",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: "hillAmount",
            label: "Hill Amount",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: "slamAmount",
            label: "Slam Amount",
            type: "modSlider",
            min: 0,
            max: 1,
            step: 0.01,
        },
        {
            key: "hillDir",
            label: "Hill Direction",
            type: "modSlider",
            min: 0,
            max: 359,
            step: 1,
        },
        {
            key: "METRIC_ORD",
            label: "Metric",
            type: "select",
            options: MetricOpts
        },
        {
            key: "outScale",
            label: "Global Scale",
            type: "modSlider",
            min: 0.1,
            max: 10,
            steps: 100
        }
    ]
}

export const effectMeta = {
  group: "Utility",
  tags: ["color", "brightness", "contrast", "saturation"],
  description: "Adjusts brightness, contrast, and saturation.",
  backend: "gpu",
  canAnimate: true,
  realtimeSafe: true,
  parameterHints: {
      "brightness": {min: -0.2, max: 0.4},
      "contrast": {min: -0.3, max: 0.5}
  },
  notInRandom: true
};

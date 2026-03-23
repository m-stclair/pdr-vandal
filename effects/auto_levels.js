import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {statsProbe} from "./probes/statsprobe.js";
import {webGLState} from "../utils/webgl_state.js";

const shaderPath = "auto_levels.frag";
const includePaths = {"colorconvert.glsl": "includes/colorconvert.glsl"};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


async function makeProbe(fx, renderer) {
    const prb = {
        config: structuredClone(statsProbe.config),
        initHook: statsProbe.initHook,
        parent: fx,
        glState: new webGLState(
            renderer, `${fx.name}-probe`, `${fx.id}-probe`
        ),
        analyze: statsProbe.analyze
    }
    await prb.initHook();
    fx.probe = prb;
}


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Auto Levels",

    defaultConfig: {
        mode: "luma",
        paramA: 0,
        paramB: 100.0,
    },

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            mode,
            paramA,
            paramB,
        } = resolveAnimAll(instance.config, t);

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
        }

        if (paramA === 0.0 && paramB === 100.0) {
            // null op
            instance.glState.renderGL(
                inputTex, outputFBO, uniformSpec, {PASSTHROUGH: 1}
            );
            return;
        }
        const probe = instance.probe;
        const {channelBounds} = probe.analyze(
            probe,
            inputTex,
            width,
            height,
            paramA,
            paramB,
        );
        const scales = []
        const offsets = []
        channelBounds.forEach(([low, high]) => {
            scales.push(Math.min(1 / (high - low), 1000));
            offsets.push(-low);
        })
        uniformSpec.u_scales = {value: scales, type: "floatArray"},
        uniformSpec.u_offsets = {value: offsets, type: "floatArray"}
        const defines = { PASSTHROUGH: 0,}
        if (mode === 'luma') {
            defines['CLIPMODE'] = '0'
        } else {
            defines['CLIPMODE'] = '1'
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },

    async initHook(fx, renderer) {
        await fragSources.load();
        await makeProbe(fx, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
    uiLayout: [
        // only have percentile, might not even want others, they suck here

        {
            key: "mode",
            label: "Mode ",
            type: "select",
            options: [
                {value: "luma", label: "Luminance"},
                {value: "channelwise", label: "Per-Channel"},
            ]
        },
        {
            type: "modSlider",
            key: "paramA",
            label: "Low %",
            min: 0,
            max: 100,
            step: 0.5
        },
        {
            type: "modSlider",
            key: "paramB",
            label: "High %",
            min: 0,
            max: 100,
            step: 0.5
        },
    ]
}

export const effectMeta = {
    group: "Utility",
    tags: ["color", "clip", "brightness", "levels", "gpu"],
    description: "Fast level-setter w/adjustable percentile bounds.",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    notInRandom: true
};

import {resolveAnimAll} from "../utils/animutils.js";
import {
    makeEnum
} from "../utils/glsl_enums.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";

const shaderPath = "input_stretch.frag"
const includePaths = {}
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const {
    enum: ClipEnum,
    names: ClipNames,
    options: ClipOpts
} = makeEnum([
    'NONE',
    'STDEV',
    'P02_P98',
])

const {
    enum: StretchEnum,
    names: StretchNames,
    options: StretchOpts
} = makeEnum([
    'LIN',
    'LOGLIKE',
    'TANH'
])

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Input Stretch",
    defaultConfig: {
        clipMode: ClipEnum.NONE,
        stretchMode: StretchEnum.LIN,
        stdevClip: 2,
        stretchParam: 2
    },
    uiLayout: [
        {'type': 'select', 'key': 'clipMode', 'label': 'Range Clip', 'options': ClipOpts},
        {'type': 'select', 'key': 'stretchMode', 'label': 'Range Stretch', 'options': StretchOpts},
        {
            'type': 'range',
            'key': 'stdevClip',
            'label': 'Standard Deviations',
            'min': 0.1,
            'max': 10,
            'step': 0.1,
            'showIf': {key: "clipMode", equals: ClipEnum.STDEV}
        },
        {
            'type': 'range',
            'key': 'stretchParam',
            'label': 'Stretch Parameter',
            'min': 0.1,
            'max': 10,
            'step': 0.1,
            'showIf': {key: "stretchMode", notEquals: StretchEnum.LIN}
        }
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            clipMode, stdevClip, stretchMode, stretchParam
        } = resolveAnimAll(instance.config, t);

        const clipModeN = Number(clipMode);
        const mean = instance.auxiliaryCache.mean;
        const std = instance.auxiliaryCache.std;
        const p02 = instance.auxiliaryCache.p02;
        const p98 = instance.auxiliaryCache.p98;
        let min, max;

        if (clipModeN === ClipEnum.STDEV) {
            if (mean === undefined || std === undefined) {;
                [min, max] = [0, 1];
            } else {
                min = mean - stdevClip * std;
                min = min < 0 ? 0 : min;
                max = mean + stdevClip * std;
                max = max > 1 ? 1 : max;
            }
        } else if (clipModeN === ClipEnum.P02_P98) {
            if (p02 === undefined || p98 === undefined) {
                [min, max] = [0, 1];
            } else {
                [min, max] = [p02, p98];
            }
        } else {
            [min, max] = [0, 1];
        }
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_min: {type: "float", value: min},
            u_max: {type: "float", value: max},
            u_stretchParam: {type: "float", value: stretchParam}
        }
        const defines = {
            STRETCH_MODE: stretchMode
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
    isGPU: true,
};

export const effectMeta = {
    group: "Utility",
    tags: ["stretch", "clip", "range"],
    description: (
        "Handles bounds clipping and range setting for potentially wide-gamut " +
        "input data prior to entering display chain."
    ),
    canAnimate: false,
    realtimeSafe: true,
    requires_f32: true,
    notInRandom: true,
    notPickable: true
}

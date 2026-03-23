import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    DebugModeOpts,
    ColorspaceOpts, ColorspaceEnum, hasChromaBoostImplementation, DebugModeEnum, DebugColorModeOpts, DebugColorModeEnum
} from "../utils/glsl_enums.js";

const shaderPath = "gen_debug.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
};

const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Debug Shader",
    defaultConfig: {
        COLORSPACE: ColorspaceEnum.RGB,
        DEBUG_MODE: DebugModeEnum.MODE_OOB_NAN_HIGHLIGHT,
        DISPLAY_CHANNEL: 0,
        DEBUG_COLOR_MODE: DebugColorModeEnum.COLOR_MODE_CHANNEL
    },
    uiLayout: [
        {
            type: "select",
            key: "DEBUG_MODE",
            label: "Mode",
            options: DebugModeOpts
        },
        {
            type: "group",
            label: "Color Options",
            showIf: {key: "DEBUG_MODE", equals: DebugModeEnum.MODE_COLOR_CHECK},
            children: [
                {
                    type: 'select',
                    key: "DEBUG_COLOR_MODE",
                    label: "Colorspace",
                    options: DebugColorModeOpts,
                },
                {
                    type: 'select',
                    key: "COLORSPACE",
                    label: "Colorspace",
                    options: ColorspaceOpts,
                },
                {
                    type: 'select',
                    key: 'DISPLAY_CHANNEL',
                    label: "Channel",
                    options: ["0", "1", "2"],
                    showIf: {
                        "key": "DEBUG_COLOR_MODE",
                        "equals": DebugColorModeEnum.COLOR_MODE_CHANNEL
                    }
                }
            ]
        }
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            DEBUG_COLOR_MODE, COLORSPACE, DISPLAY_CHANNEL, DEBUG_MODE
        } = resolveAnimAll(instance.config, t);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
        };

        const defines = {
            DEBUG_COLOR_MODE: DEBUG_COLOR_MODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),            DEBUG_MODE: DEBUG_MODE,
            DISPLAY_CHANNEL: DISPLAY_CHANNEL
        };
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
    group: "Utility",
    tags: ["debug"],
    description: "Tool to check for glitches in and properties of various " +
        "space and color properties",
    canAnimate: false,
    realtimeSafe: false,
};

import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum, hasChromaBoostImplementation,
    ZoneShapeEnum,

} from "../utils/glsl_enums.js";
import {blendControls, group, zoneControls} from "../utils/ui_configs.js";

const shaderPath = "warpzone.glsl";
const includePaths = {
    "zones.glsl": "includes/zones.glsl",
    "psrdnoise2.glsl": "includes/noises/psrdnoise2.glsl",
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Warp Zone",

    defaultConfig: {
        COLORSPACE: ColorspaceEnum.RGB,
        BLENDMODE: BlendModeEnum.MIX,
        blendAmount: 1,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        ZONESHAPE: ZoneShapeEnum.SUPERELLIPSE,
        zoneCX: 0.5,
        zoneSX: 0.6,
        zoneCY: 0.5,
        zoneSY: 0.6,
        zoneEllipseN: 2,
        zoneSoftness: 0.1,
        WARPMODE: "lens",
        paramA: 0,
        paramB: 0,
        warpStrength: 25,
        PREBLEND_WARP_CHANNEL: 2,
        WARPDRIVE_COLORSPACE: 6,
        WARPDRIVE_MODE: 0,
        WARPDRIVE_CHANNEL: 2,
        zoneAngle: 0,
        warpAngle: 0,
        chromaBoost: 1
    },
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            BLENDMODE, COLORSPACE, BLEND_CHANNEL_MODE, blendAmount,
            ZONESHAPE, zoneCX, zoneSX, zoneCY, zoneSY,
            zoneSoftness, zoneEllipseN, paramA, WARPMODE,
            warpStrength, WARPDRIVE_CHANNEL, WARPDRIVE_COLORSPACE,
            WARPDRIVE_MODE, PREBLEND_WARP_CHANNEL, paramB, warpAngle,
            zoneAngle, chromaBoost
        } = resolveAnimAll(instance.config, t);
        let xMax = zoneCX + zoneSX / 2;
        let yMax = zoneCY + zoneSY / 2;
        let xMin = zoneCX - zoneSX / 2;
        let yMin = zoneCY - zoneSY / 2;
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {value: blendAmount, type: "float"},
            u_zoneSoftness: {value: zoneSoftness, type: "float"},
            u_zoneEllipseN: {value: zoneEllipseN, type: "float"},
            u_zoneMin: {value: [xMin, yMin], type: "vec2"},
            u_zoneMax: {value: [xMax, yMax], type: "vec2"},
            u_param_a: {value: paramA, type: "float"},
            u_param_b: {value: paramB * zoneSoftness, type: "float"},
            u_warpStrength: {value: warpStrength, type: "float"},
            u_warpAngle: {value: warpAngle, type: "float"},
            u_zoneAngle: {value: zoneAngle, type: "float"},
            u_chromaBoost: {type: "float", value: chromaBoost},
        };
        const warpCode = {
            "shift": 0, "sine": 1, "noise": 2, "lens": 3
        }[WARPMODE];

        const defines = {
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            ZONESHAPE: ZONESHAPE,
            WARPMODE: warpCode,
            WARPDRIVE_MODE: WARPDRIVE_MODE,
            WARPDRIVE_COLORSPACE: WARPDRIVE_COLORSPACE,
            WARPDRIVE_CHANNEL: WARPDRIVE_CHANNEL,
            PREBLEND_WARP_CHANNEL: PREBLEND_WARP_CHANNEL,
            PREBLEND_CHANNEL_WARP: Number(paramB > 0),
        };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },

    uiLayout: [
        zoneControls(),

        group("Warp Settings", [
            {
                type: "modSlider",
                key: "warpAngle",
                label: "Warp Angle",
                min: 0,
                max: Math.PI * 2,
                steps: 200
            },
            {
                type: "modSlider",
                key: "warpStrength",
                label: "Warp Strength",
                min: -100,
                max: 100,
                steps: 200
            },
            {
                key: 'paramA',
                label: 'Warp Parameter 1',
                type: 'modSlider',
                min: 0,
                max: 1,
                steps: 200
            },
            {
                type: "select",
                key: "WARPMODE",
                label: "Warp Mode",
                options: ["shift", "sine", "noise", "lens"]
            }
        ], {color: "#200010"}),

        blendControls(),

        group("Warpdrive Settings", [
            {
                key: 'WARPDRIVE_MODE',
                label: 'Warpdrive Mode',
                type: 'Select',
                options: [
                    {'label': 'none', 'value': 0},
                    {'label': 'channeldrive', 'value': 1}
                ]
            },
            {
                key: 'WARPDRIVE_COLORSPACE',
                label: 'Warpdrive Colorspace',
                type: 'Select',
                options: [
                    {'label': 'RGB', 'value': ColorspaceEnum.RGB},
                    {'label': 'LCH', 'value': ColorspaceEnum.LCH},
                    {'label': 'HSL', 'value': ColorspaceEnum.HSL}
                ]
            },
            {
                key: 'WARPDRIVE_CHANNEL',
                label: 'Warpdrive Channel',
                type: 'Select',
                options: [
                    {'label': '1', 'value': 0},
                    {'label': '2', 'value': 1},
                    {'label': '3', 'value': 2}
                ]
            }
        ], {color: "#001a1a"}),

        group("Preblend Warp", [
            {
                key: 'paramB',
                label: 'Preblend Color Warp',
                type: 'modSlider',
                min: 0,
                max: 1,
                steps: 200
            },
            {
                key: 'PREBLEND_WARP_CHANNEL',
                label: 'Preblend Color Warp Channel',
                type: 'Select',
                options: [
                    {'label': 'Chroma', 'value': 1},
                    {'label': 'Hue', 'value': 2}
                ]
            }
        ], {color: "#1a001a"})
    ],
    initHook: fragSources.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
};

export const effectMeta = {
    group: "Geometry",
    tags: ["mask", "shape", "warp"],
    description: "Applies a spatially-bounded warping mask.",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        warpStrength: {min: 25, max: 100},
        zoneSoftness: {min: 0, max: 0.25},
        blendAmount: {min: 0.6, max: 1}
    }
};

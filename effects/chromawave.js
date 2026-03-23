import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {blendControls, group} from "../utils/ui_configs.js";
import {hasChromaBoostImplementation} from "../utils/glsl_enums.js";

const shaderPath = "chromawave.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Chromawave",
    defaultConfig: {
        threshold: 0.45,
        cycle: true,
        cycleMode: "spatial",
        hueShift: 180,
        saturation: 100,
        lightness: 50,
        hueSpread: 1,
        bleed: 0,
        COLORSPACE: 0,
        BLENDMODE: 1,
        BLEND_CHANNEL_MODE: 0,
        blendAmount: 1,
        chromaBoost: 1,
        bandingSteps: 0,
        waveType: 0,
        dutyCycle: 0.5,
        originX: 0.5,
        originY: 0.5,
        spatialPattern: "radial",

    },
    uiLayout: [
        {type: "modSlider", key: "threshold", label: "Thresh", min: 0, max: 1, step: 0.01},

        {
            type: "select",
            key: "cycleMode",
            label: "Cycle Mode",
            options: ["hue", "luma", "spatial"]
        },

        group("Hue Mapping", [
            {type: "modSlider", key: "hueShift", label: "Shift", min: 0, max: 2, step: 0.01},
            {
                type: "modSlider",
                key: "hueSpread",
                label: "Spread",
                min: 0,
                max: 10,
                steps: 200,
                scale: "log",
                scaleFactor: 3
            },
        ], {
            color: "#20001a"
        }),

        group("Spatial Pattern", [
            {
                type: "Select",
                key: "spatialPattern",
                label: "Pattern",
                options: ["radial", "horizontal", "vertical", "diagonal", "angle", "checker"]
            },
            {type: "modSlider", key: "originX", label: "X Origin", min: 0, max: 1, step: 0.01},
            {type: "modSlider", key: "originY", label: "Y Origin", min: 0, max: 1, step: 0.01}
        ], {
            showIf: {key: "cycleMode", equals: "spatial"},
            color: "#001a20"
        }),

        group("Color Adjustments", [
            {type: "range", key: "saturation", label: "Saturation", min: 0, max: 100, step: 1},
            {type: "range", key: "lightness", label: "Lightness", min: 0, max: 100, step: 1},
            {type: "range", key: "bleed", label: "Bleed", min: 0, max: 1, step: 0.01}
        ], {color: "#1a1a00"}),

        group("Waveform Controls", [
            {type: "Select", key: "waveType", label: "Waveform", options: ["saw", "tri", "sine", "square"]},
            {type: "range", key: "bandingSteps", label: "Bands", min: 0, max: 5, step: 1},
            {type: "range", key: "dutyCycle", label: "Duty Cycle", min: 0.01, max: 0.99, step: 0.01}
        ], {color: "#1a0000"}),

        blendControls(),
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            saturation,
            lightness,
            cycleMode,
            hueShift,
            hueSpread,
            threshold,
            bleed,
            COLORSPACE,
            BLENDMODE,
            blendAmount,
            bandingSteps,
            waveType,
            dutyCycle,
            originX,
            originY,
            spatialPattern,
            BLEND_CHANNEL_MODE,
            chromaBoost
        } = resolveAnimAll(instance.config, t);

        let satNorm, lightNorm, shiftNorm, spreadNorm;
        const CHROMAWAVE_CYCLE = {"hue": 0, "luma": 1, "spatial": 2}[cycleMode];
        if (CHROMAWAVE_CYCLE === 0) {
            satNorm = saturation / 100;
            lightNorm = lightness / 100;
            shiftNorm = hueShift;
            spreadNorm = ((hueSpread * 3) ** 0.4);
        } else if (CHROMAWAVE_CYCLE === 1) {
            satNorm = saturation / 100;
            lightNorm = lightness / 100;
            shiftNorm = (hueShift / 4) ** 0.7;
            spreadNorm = (hueSpread / 2) ** 0.5;
        } else {
            satNorm = saturation / 100;
            lightNorm = lightness / 100;
            shiftNorm = hueShift / 2;
            spreadNorm = (hueSpread * 2) ** 0.8;
        }
        const waveCode = {"saw": 0, "tri": 1, "sine": 2, "square": 3}[waveType]
        const patternCode = {
            "radial": 0, "horizontal": 1, "vertical": 2,
            "diagonal": 3, "angle": 4, "checker": 5
        }[spatialPattern];
        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_blendamount: {type: "float", value: blendAmount},
            u_resolution: {type: "vec2", value: [width, height]},
            u_threshold: {type: "float", value: threshold},
            u_shiftNorm: {type: "float", value: shiftNorm},
            u_spreadNorm: {type: "float", value: spreadNorm},
            u_bleed: {type: "float", value: bleed},
            u_satNorm: {type: "float", value: satNorm},
            u_lightNorm: {type: "float", value: lightNorm},
            u_duty: {type: "float", value: dutyCycle},
            u_bandingSteps: {type: "float", value: bandingSteps},
            u_origin: {type: "vec2", value: [originX * width, originY * height]},
            u_chromaBoost: {type: "float", value: chromaBoost}
        };
        const defines = {
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            CHROMAWAVE_CYCLE: CHROMAWAVE_CYCLE,
            CHROMAWAVE_BLEED: Number(bleed > 0),
            USE_BANDING: Number(bandingSteps > 0),
            WAVETYPE: waveCode,
            SPATIAL_PATTERN: patternCode
        }
        instance.glState.renderGL(inputTex, outputFBO, uniforms, defines);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    initHook: fragSources.load,
    glState: null,
    isGPU: true
}

export const effectMeta = {
    group: "Synthesis",
    tags: ["color", "synth", "AM/FM", "threshold", "rainbow"],
    description: "Modulates color image using a synthetic hue gradient " +
        "based on image-space coordinates, relative brightness, or hue self-modulation. " +
        "Dark areas can be masked out. The hue field can radiate in various patterns, with " +
        "optional interpolation toward the original hue. " +
        "Useful for creating radiant overlays, ink-on-pastel, false-color maps, or psychedelic " +
        "sunburst effects.",
    backend: "gpu",
    animated: true,
    realtimeSafe: true,
    parameterHints: {
        threshold: {min: 0, max: 0.6},
        saturation: {min: 40, max: 100},
        lightness: {min: 40, max: 60}
    }
}
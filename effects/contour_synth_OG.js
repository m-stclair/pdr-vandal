import {deg2rad} from "../utils/mathutils.js";
import waves from "../utils/waves.js";
import patterns from "../utils/patterns.js";
import {getLuminance, hsl2Rgb, rgb2Hsl} from "../utils/colorutils.js";
import {resolveAnimAll} from "../utils/animutils.js";

function spatialPhase(x, y, width, height, freq, mode) {
    if (mode === "none") return 0;
    const xNorm = x / width;
    const yNorm = y / height;
    switch (mode) {
        case "xy":
            return patterns.bands(xNorm, yNorm, freq);
        case "checker":
            return patterns.checks(xNorm, yNorm, freq);
        case "radial": {
            return patterns.radial(xNorm, yNorm, freq);
        }
        case "rings": {
            return patterns.rings(xNorm, yNorm, freq);
        }
        default:
            return 0;
    }
}


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Contour Synth",
    defaultConfig: {
        freq: 1,
        freqScale: 1,
        phaseScale: 1,
        blend: 0.5,
        phaseOff: 0,
        spatialMode: "xy",
        colorMode: "none",
        hueModStrength: 0.5
    },
    uiLayout: [
        {
            type: "modSlider",
            key: "freq",
            label: "Spatial Frequency",
            min: 0,
            max: 100,
            steps: 100,
            scale: "log",
            scaleFactor: 2
        },
        {
            type: "modSlider",
            key: "freqScale",
            label: "Spatial Frequency Modulation",
            min: 0,
            max: 10,
            steps: 100,
            scale: "log",
            scaleFactor: 2
        },
        {
            type: "modSlider",
            key: "phaseScale",
            label: "Phase Modulation",
            min: 0,
            max: 20,
            steps: 100,
            scale: "log",
            scaleFactor: 2
        },
        {type: "modSlider", key: "phaseOff", label: "Phase Offset", min: -180, max: 180, step: 1.5},
        {type: "modSlider", key: "blend", label: "Blend", min: 0, max: 1, step: 0.01},
        {
            type: "select",
            key: "waveform",
            label: "Waveform",
            options: [
                {value: "sin", label: "Sinusoidal"},
                {value: "sawtooth", label: "Sawtooth"},
                {value: "square", label: "Square"},
                {value: "tri", label: "Triangle"}
            ]
        },
        {
            type: "select",
            key: "spatialMode",
            label: "Spatial Mode",
            options: [
                {value: "none", label: "None"},
                {value: "xy", label: "Bands"},
                {value: "checker", label: "Checkerboard"},
                {value: "radial", label: "Radial"},
                {value: "rings", label: "Rings"}
            ]
        },
        {
            type: "select",
            key: "colorMode",
            label: "Color Mode",
            options: [
                {value: "none", label: "Grey"},
                {value: "preserve", label: "Darken"},
                {value: "pass", label: "Passthrough"},
                {value: "hueMod", label: "Hue Mod"},
            ]
        },
        {
            type: "modSlider",
            key: "hueModStrength",
            label: "Hue Mod Strength",
            min: 0,
            max: 1,
            step: 0.01,
            showIf: {colormode: "hueMod"}
        }
    ],

    apply(instance, data, width, height, t) {
        const {
            freq,
            freqScale,
            phaseOff,
            phaseScale,
            blend,
            hueModStrength,
            spatialMode,
            waveform,
            colorMode
        } = resolveAnimAll(instance.config);
        const phaseOffRad = deg2rad(phaseOff);
        let waveFunc;
        switch (waveform) {
            case "sawtooth":
                waveFunc = waves.saw;
                break;
            case "square":
                waveFunc = waves.square;
                break;
            case "sin":
                waveFunc = Math.sin;
                break;
            case "tri":
                waveFunc = waves.tri;
                break;
            default:
                waveFunc = Math.sin;
        }
        const outputData = new Float32Array(data.length);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const lum = getLuminance(r, g, b);
                const phase = lum * Math.PI * 2;
                const spatial = spatialPhase(x, y, width, height, freq, spatialMode);
                const patternA = waveFunc(spatial * freqScale + phase);
                const patternB = waveFunc(
                    -phase * (
                        (spatial * freqScale + phase * phaseScale)
                    ) + phaseOffRad
                );
                const patval = Math.abs(patternA - patternB);
                if (colorMode === "none") {
                    const val = patval * blend + lum * (1 - blend);
                    outputData[i] = val;
                    outputData[i + 1] = val;
                    outputData[i + 2] = val;
                    outputData[i + 3] = 1;
                } else if (colorMode === "preserve") {
                    const val = patval < lum ? patval * blend : 0;
                    outputData[i] = r - val;
                    outputData[i + 1] = g - val;
                    outputData[i + 2] = b - val;
                    outputData[i + 3] = 1;
                } else if (colorMode === "pass") {
                    const [h, s, l] = rgb2Hsl(r, g, b);
                    const val = patval * blend + l * (1 - blend);
                    const [r0, g0, b0] = hsl2Rgb(h, s, val);
                    outputData[i] = r0;
                    outputData[i + 1] = g0;
                    outputData[i + 2] = b0;
                    outputData[i + 3] = 1;
                } else if (colorMode === "hueMod") {
                    const [h, s, l] = rgb2Hsl(r, g, b);
                    const mod = (patval) * hueModStrength;
                    const newHue = (h + mod) % 1;
                    const [r1, g1, b1] = hsl2Rgb(newHue, s, l);
                    outputData[i] = r1;
                    outputData[i + 1] = g1;
                    outputData[i + 2] = b1;
                    outputData[i + 3] = 1;
                } else {
                    throw new Error("bad color mode");
                }
            }
        }
        return outputData;
    }
}

export const effectMeta = {
  group: "Synthesis",
  tags: ["synth", "contour", "pattern", "generatied", "animated"],
  description: "A synthetic topography generator that overlays " +
      "contour-line patterns by modulating spatial " +
      "derivatives of luminance. Contour spacing and directionality are driven " +
      "by waveforms or spatial fields, enabling results that range from " +
      "stark monochrome etchings to vibrant interference textures to " +
      "hallucinatory landscape modulations. Behaves like a hybrid between an " +
      "edge detector, a terrain visualizer, and an FM synth. Also suitable " +
      "as a standalone pattern generator.",
  canAnimate: true,
  realtimeSafe: true,
};

import {combineChannels, splitChannels} from "../utils/imageutils.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {colorSpaces} from "../utils/colorutils.js";
import {clamp, dot3} from "../utils/mathutils.js";

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Matrix Channel Mixer",

    defaultConfig: {
      colorSpaceIn: "rgb",    // "rgb" | "hsv" | "hsl"
      colorSpaceOut: "rgb",   // (optional; default to match input)
      mixMatrix: [
        [1, 0, 0],   // output channel 0 = mix of input channels
        [0, 1, 0],
        [0, 0, 1]
      ],
      offset: [0, 0, 0],
    },

    apply(instance, data, width, height, t) {
        const { config } = instance;
        const { r, g, b, a } = splitChannels(data, width, height);
        const resolved = resolveAnimAll(config, t);
        const { mixMatrix, offset } = resolved;
        const toSpace = colorSpaces[resolved.colorSpaceIn].to;
        const fromSpace = colorSpaces[resolved.colorSpaceOut].from;

        const outR = new Float32Array(r.length);
        const outG = new Float32Array(r.length);
        const outB = new Float32Array(r.length);

        for (let i = 0; i < r.length; i++) {
            const [c0, c1, c2] = toSpace(r[i], g[i], b[i]);
            const x = clamp(dot3(mixMatrix[0], [c0, c1, c2]) + offset[0], 0, 1);
            const y = clamp(dot3(mixMatrix[1], [c0, c1, c2]) + offset[1], 0, 1);
            const z = clamp(dot3(mixMatrix[2], [c0, c1, c2]) + offset[2], 0, 1);
            const [rOut, gOut, bOut] = fromSpace(x, y, z);
            outR[i] = rOut;
            outG[i] = gOut;
            outB[i] = bOut;
        }
        return combineChannels({ r: outR, g: outG, b: outB, a, width, height })

    },

    uiLayout: [
        {
            key: "colorSpaceIn",
            label: "Input Color Space",
            type: "select",
            options: Object.keys(colorSpaces),
        },
        {
            key: "colorSpaceOut",
            label: "Output Color Space",
            type: "select",
            options: Object.keys(colorSpaces),
        },
        {
            key: "mixMatrix",
            label: "Channel Mix",
            type: "matrix",
            size: [3, 3],
            min: -1,
            max: 1,
            step: 0.01,
            rowLabels: (config) => colorSpaces[config.colorSpaceOut]?.channelLabels ?? ["C1", "C2", "C3"],
            colLabels: (config) => colorSpaces[config.colorSpaceIn]?.channelLabels ?? ["C1", "C2", "C3"],
        },
        {
            key: "offset",
            label: "Offset",
            type: "vector",
            length: 3,
            subLabels: (config) => colorSpaces[config.colorSpaceOut]?.channelLabels ?? ["C0", "C1", "C2"],
            min: -1,
            max: 1,
            step: 0.01,
        },
    ]
}

export const effectMeta = {
  group: "Color",
  tags: ["color", "rgb", "matrix", "mix"],
  description: "Applies a 3×3 matrix transformation across "
    + "colorspaces.",
  canAnimate: true,
  realtimeSafe: false,  // full-frame matrix multiply on CPU
};
import {deg2rad} from "../utils/mathutils.js";
import {channelwise, normalizeRange} from "../utils/stretch.js";

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Hillshade",

    defaultConfig: {
        azimuth: 0.5,
        mode: "lambertian",
    },

    apply(instance, data, width, height, t) {
        const result = new Float32Array(data.length);
        const {azimuth, mode} = instance.config;
        const azrad = deg2rad(azimuth)
        const cosAz = Math.cos(azrad);
        const sinAz = Math.sin(azrad);

        function idx(x, y) {
            return (y * width + x) * 4;
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = idx(x, y);
                const center = data[i]; // Red channel as elevation

                const left = x > 0 ? data[idx(x - 1, y)] : center;
                const up = y > 0 ? data[idx(x, y - 1)] : center;

                const dx = left - center;
                const dy = up - center;

                let shade = dx * cosAz + dy * sinAz;

                switch (mode) {
                    case "magnitude":
                        shade = Math.abs(shade);
                        break;
                    case "lambertian":
                        shade = Math.max(0, shade);
                        break;
                    // "signed" case falls through with raw value
                }

                const val = Math.max(0, Math.min(1, shade));
                result[i] = result[i + 1] = result[i + 2] = val;
                result[i + 3] = 1;
            }
        }
        return channelwise(result, width, height, normalizeRange)
    },

    uiLayout: [
        {
            type: "range",
            key: "azimuth",
            label: "Light Direction (radians)",
            min: 0, max: 360, step: 1
        },
        {
            type: "select",
            key: "mode",
            label: "Shading Mode",
            options: ["magnitude", "signed", "lambertian"]
        },
    ]
};


export const effectMeta = {
  group: "Weird",
  tags: ["hillshade", "terrain", "cpu", "luminance"],
  description: "Computes a hillshaded relief effect from luminance gradients, " +
      "simulating directional lighting across a virtual surface.",
  canAnimate: false,
  realtimeSafe: true,
};
import {resolveAnimAll} from "../utils/animutils.js";

const noise = function (x, y) {
    const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return seed - Math.floor(seed);
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: 'Pixel Sort',

    defaultConfig: {
        threshold: 0.5,
        direction: 'horizontal',
        useR: true,
        useG: true,
        useB: true,
        perlin: false,
    },

    apply(instance, data, width, height, t) {
        const sortedData = new Float32Array(data);
        const {threshold, direction, useR, useG, useB, perlin} = resolveAnimAll(instance.config, t);

        const brightness = (p, x, y) => {
            let value = 0;
            const scl = [+useR, +useG, +useB].reduce((a, b) => a + b);
            if (scl === 0) return 0;
            if (useR) value += p.r;
            if (useG) value += p.g;
            if (useB) value += p.b;
            if (perlin) value += 128 * noise(x * 0.02, y * 0.02);
            return value / scl;
        };

        const getPixel = (i) => ({
            r: data[i],
            g: data[i + 1],
            b: data[i + 2],
            a: data[i + 3]
        });

        const setPixel = (i, p) => {
            sortedData[i] = p.r;
            sortedData[i + 1] = p.g;
            sortedData[i + 2] = p.b;
            sortedData[i + 3] = p.a;
        };

        const sortLine = (startIdx, stride, length, fixedCoord, isHorizontal) => {
            const line = [];
            for (let i = 0; i < length; i++) {
                const idx = startIdx + i * stride;
                const pixel = getPixel(idx);
                const [x, y] = isHorizontal ? [i, fixedCoord] : [fixedCoord, i];
                const b = brightness(pixel, x, y);
                line.push({pixel, brightness: b});
            }

            const sorted = [...line].sort((a, b) => a.brightness - b.brightness);

            for (let i = 0; i < length; i++) {
                const idx = startIdx + i * stride;
                const original = line[i];
                if (original.brightness > threshold) {
                    setPixel(idx, sorted[i].pixel);
                } else {
                    setPixel(idx, original.pixel);
                }
            }
        };

        if (direction === 'horizontal') {
            for (let y = 0; y < height; y++) {
                sortLine(y * width * 4, 4, width, y, true);
            }
        } else {
            for (let x = 0; x < width; x++) {
                sortLine(x * 4, width * 4, height, x, false);
            }
        }

        return sortedData;
    },

    uiLayout: [
        {type: 'modSlider', key: 'threshold', label: 'Threshold', min: 0, max: 1, step: 0.01},
        {type: 'select', key: 'direction', label: 'Direction', options: ['horizontal', 'vertical']},
        {type: 'checkbox', key: 'useR', label: 'Use R'},
        {type: 'checkbox', key: 'useG', label: 'Use G'},
        {type: 'checkbox', key: 'useB', label: 'Use B'},
        {type: 'checkbox', key: 'perlin', label: 'Perlin Mask'}
    ]
};

export const effectMeta = {
  group: "Glitch",
  tags: ["glitch", "sort", "cpu", "disruption", "stripe"],
  description: "Performs directional pixel sorting based on channel-dependent brightness thresholds. '" +
      "Can produce hard glitch streaks, gentle smearing, or luminous breathing effects.",
  canAnimate: true,
  realtimeSafe: false, // sorting is slow
};

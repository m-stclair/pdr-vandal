import { makeSampler } from '../utils/shredutils.js';
import {resolveAnimAll} from "../utils/animutils.js";
import {splitChannels} from "../utils/imageutils.js";
import {val2Bin} from "../utils/mathutils.js";

function shredTuples(data, width, height, valuesToReplace, tuples, nBins, counts) {
    const valueSet = new Set(valuesToReplace);
    const result = new Float32Array(data.length);

    const allKeys = Array.from(counts.keys());
    const replacementPool = allKeys.filter(k => !valueSet.has(k));

    const weights = replacementPool.map(k => counts.get(k));
    const total = weights.reduce((a, b) => a + b, 0);
    const sampler = makeSampler(weights.map(w => w / total));

    for (let i = 0; i < data.length; i += 4) {
        const key = tuples[i];
        const shouldReplace = valueSet.has(key);

        if (shouldReplace) {
            const [rBin, gBin, bBin] = sampler(replacementPool)
            result[i]     = rBin / nBins;
            result[i + 1] = gBin / nBins;
            result[i + 2] = bBin / nBins;
        } else {
            result[i]     = data[i];
            result[i + 1] = data[i + 1];
            result[i + 2] = data[i + 2];
        }
        result[i + 3] = data[i + 3]; // preserve alpha
    }

    return result;
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "JointShred",

    defaultConfig: {
        density: 0.1,
        nBins: 4
    },

    apply(instance, data, width, height, t) {
        const counts = new Map();
        const { density, nBins } = resolveAnimAll(instance.config, t);
        const {r, g, b, a} = splitChannels(data, width, height);
        const [rBins, gBins, bBins] = [r, g, b].map(c => c.map(v => val2Bin(v, 0, nBins)));
        const tuples = Array(data.length);
        for (let i = 0; i < data.length; i += 4) {
            const key = [rBins[i], gBins[i], bBins[i]];
            counts.set(key, (counts.get(key) || 0) + 1);
            tuples[i] = key;
        }
        const valuesToReplace = [];
        for (let key of counts.keys()) {
            if (Math.random() < density) {
                valuesToReplace.push(key);
            }
        }
        return shredTuples(data, width, height, valuesToReplace, tuples, nBins, counts);
    },

    uiLayout: [
        { type: "modSlider", key: "density", label: "Density", min: 0, max: 0.99, step: 0.01 },
        { type: "modSlider", key: "nBins", label: "nBins", min: 2, max: 32, step: 1 },
    ]
};

export const effectMeta = {
  group: "Glitch",
  tags: ["glitch", "quantize", "color", "slow", "cpu"],
  description: "Quantizes RGB channels codependently using joint histograms, " +
      "producing palette-preserving colored noise. Very slow.",
  canAnimate: true,
  realtimeSafe: false,
};

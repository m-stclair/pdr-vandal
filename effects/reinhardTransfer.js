import {getImageStats} from "../utils/paletteutils.js";
import {lab2Rgb_A, rgb2Lab_A} from "../utils/colorutils.js";
import {normalizeImageData} from "../utils/imageutils.js";

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Reinhard Transfer",
    defaultConfig: {
        referenceImageId: null,
        strength: 1.0
    },
    uiLayout: [
        {
            type: "referenceImage",
            key: "referenceImageId",
            label: "Style Source"
        },
        {
            type: "range",
            key: "strength",
            label: "Transfer Strength",
            min: 0,
            max: 1,
            step: 0.01
        }
    ],

    apply(instance, data, _width, _height, _t) {
        const {referenceImageId, strength} = instance.config;
        const referenceImage = instance.auxiliaryCache.referenceImage;
        if (!referenceImageId || !referenceImage) {
            return data; // No style source: passthrough
        }
        const cacheKey = `stats-${referenceImageId}`;
        let normRef = instance.auxiliaryCache.normRefs[cacheKey];
        if (!normRef) {
            normRef = normalizeImageData({...instance.auxiliaryCache.referenceImage}).data;
            instance.auxiliaryCache.normRefs[cacheKey] = normRef;
        }
        if (!instance.auxiliaryCache.refLabs[cacheKey]) {
            instance.auxiliaryCache.refLabs[cacheKey] = rgb2Lab_A(normRef);
        }
        const refLab = instance.auxiliaryCache.refLabs[cacheKey]
        if (!instance.auxiliaryCache.stats[cacheKey]) {
            instance.auxiliaryCache.stats[cacheKey] = getImageStats(refLab);
        }
        const sourceStats = instance.auxiliaryCache.stats[cacheKey];
        const inputLabA = rgb2Lab_A(data);
        const inputStats = getImageStats(inputLabA);
        const outLabA = new Float32Array(inputLabA.length);

        for (let i = 0; i < inputLabA.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                const x = inputLabA[i + c];
                const centered = x - inputStats.mean[c];
                const scaled = centered * (sourceStats.std[c] / inputStats.std[c]);
                const shifted = scaled + sourceStats.mean[c];
                outLabA[i + c] = (1 - strength) * x + strength * shifted;
            }
            outLabA[i + 3] = inputLabA[i + 3]; // Alpha passthrough
        }
        return new Float32Array(lab2Rgb_A(outLabA));
    },

    initHook(instance) {
        instance.auxiliaryCache = {
            referenceImage: null,
            normRefs: {},
            stats: {},
            refLabs: {}
        };
    },

    cleanupHook(instance) {
        instance.auxiliaryCache.referenceImage = null;
        instance.auxiliaryCache.normRefs = null;
        instance.auxiliaryCache.stats = null;
        instance.auxiliaryCache.refLabs = null;
    }
}

export const effectMeta = {
  group: "Color",
  tags: ["tone", "transfer", "reinhard", "hdr", "slow", "cpu"],
  description: "Applies a global tone mapping curve (Reinhard operator) from a " +
      "sideloaded reference image. Can produce LUT-like behavior or provide dynamic " +
      "range compression. Slow on large images.",
  canAnimate: false,
  realtimeSafe: false,
};
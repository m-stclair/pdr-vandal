import {getPalette} from "../utils/paletteutils.js";

function renderSwatchImage(palette, width, height) {
    const swatchWidth = Math.floor(width / palette.length);
    const out = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < palette.length; i++) {
        const [r, g, b] = palette[i];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < swatchWidth; x++) {
                const px = (y * width + i * swatchWidth + x) * 4;
                out[px] = r;
                out[px + 1] = g;
                out[px + 2] = b;
                out[px + 3] = 1;
            }
        }
    }

    return new ImageData(out, width, height);
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "PaletteDebug",
    defaultConfig: {
        nColors: 6, mode: "lightness", lWeight: 1, referenceImageId: null
    },
    uiLayout: [{type: "range", key: "nColors", label: "Colors", min: 2, max: 12, step: 1}, {
        type: "select",
        key: "mode",
        label: "Distance Mode",
        options: [{label: "Lightness Slicing", value: "lightness"}, {
            label: "Chroma Only",
            value: "chroma"
        }, {label: "LAB Distance", value: "lab"}, {label: "Weighted LAB", value: "weighted"}]
    },
        {
        type: "range", key: "lWeight", label: "L* Weight (if weighted)", min: 0, max: 2, step: 0.1
    },
    { type: "referenceImage", key: "referenceImageID", label: "Reference Image" }
],

    apply(instance, imageData) {
        if (!instance.config.referenceImageID) return imageData;
        const palette = getPalette(instance);
        return renderSwatchImage(palette, imageData.width, Math.floor(imageData.height / 3));
    },

    initHook(instance) {
        instance.auxiliaryCache = {
            configHash: null, referenceImage: null, palette: null
        };
    },

    cleanupHook(instance) {
        instance.auxiliaryCache.palette = null;
        instance.auxiliaryCache.referenceImage = null;
    }
};

export const effectMeta = {
  group: "Utility",
  tags: ["palette", "debug", "cpu"],
  description: "Takes a colormap or palette, optionally extracted from an image," +
      "and displays it in a preview strip. Used for debugging or color inspection.",
  canAnimate: false,
  realtimeSafe: true,
};
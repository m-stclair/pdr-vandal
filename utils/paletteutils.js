import {hashObject} from "./helpers.js";
import {rgb2Lab} from "./colorutils.js";


export function extractFakePCAPalette(imageData, nColors = 6, mode = "chroma",
                                      lWeight = 0.5) {
    const {data} = imageData;
    const labPixels = [];

    for (let i = 0; i < data.length; i += 4) {
        const rgb = [data[i], data[i + 1], data[i + 2]];
        labPixels.push({lab: rgb2Lab(...rgb), rgb});
    }

    // Sort by L*
    labPixels.sort((a, b) => a.lab[0] - b.lab[0]);
    if (mode === "lightness") {
        // Simple spread across lightness range
        const palette = [];
        for (let i = 0; i < nColors; i++) {
            const ix = Math.floor(i * (labPixels.length - 1) / (nColors - 1));
            palette.push(labPixels[ix].rgb);
        }
        return palette;
    }

    const distance = {
        chroma: (a, b) => Math.hypot(a[1] - b[1], a[2] - b[2]),
        lab: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
        weighted: (a, b) => Math.hypot((a[0] - b[0]) * lWeight, a[1] - b[1], a[2] - b[2])
    }[mode];

    const selected = [labPixels.reduce(
        (a, b) => distance(a.lab, b.lab) > distance(b.lab, a.lab) ? a : b)];
    const used = new Set([selected[0]]);

    while (selected.length < nColors) {
        let best = null;
        let bestDist = -Infinity;

        for (const cand of labPixels) {
            if (used.has(cand)) continue;

            const minDist = Math.min(...selected.map(p => distance(cand.lab, p.lab)));

            if (minDist > bestDist) {
                bestDist = minDist;
                best = cand;
            }
        }

        if (!best) break;
        selected.push(best);
        used.add(best);
    }
    return selected.map(p => p.rgb);
}

export function getPalette(instance) {
    const cache = instance.auxiliaryCache;
    const configHash = hashObject(instance.config)
    if (cache.configHash !== configHash) {
        cache.configHash = configHash;
        cache.palette = extractFakePCAPalette(instance.auxiliaryCache.referenceImage,
            instance.config.nColors, instance.config.mode, instance.config.lWeight);
    }
    return cache.palette;
}


export function getImageStats(data) {
    const channels = [[], [], []];

    for (let i = 0; i < data.length; i += 4) {
        channels[0].push(data[i]);
        channels[1].push(data[i + 1]);
        channels[2].push(data[i + 2]);
    }

    return {
        mean: channels.map(ch => ch.reduce((a, b) => a + b, 0) / ch.length), std: channels.map((ch, i) => {
            const m = ch.reduce((a, b) => a + b, 0) / ch.length;
            const v = ch.reduce((sum, x) => sum + (x - m) ** 2, 0) / ch.length;
            return Math.sqrt(v);
        })
    };
}


export function preprocessPalette(palette) {
    const MAX_SIZE = 128;
    const STRIDE = 4;
    const paletteBlock = new Float32Array(MAX_SIZE * STRIDE);

    for (let i = 0; i < palette.length; i++) {
        paletteBlock[i * 4 + 0] = palette[i][0];
        paletteBlock[i * 4 + 1] = palette[i][1];
        paletteBlock[i * 4 + 2] = palette[i][2];
        paletteBlock[i * 4 + 3] = 0;
    }

    // each L, C, cosH, sinH is a vec4, so 4 4-byte elements each
    const paletteFeatures = new Float32Array(MAX_SIZE * STRIDE);
    for (let i = 0; i < palette.length; i++) {
        const [L, a, b] = palette[i];
        const C = Math.hypot(a, b);
        const h = Math.atan2(b, a);
        const cosH = Math.cos(h);
        const sinH = Math.sin(h);
        const start = i * STRIDE;
        paletteFeatures[start] = L;
        paletteFeatures[start + 1] = C;
        paletteFeatures[start + 2] = cosH;
        paletteFeatures[start + 3] = sinH;
    }
    return {paletteBlock, paletteFeatures};
}
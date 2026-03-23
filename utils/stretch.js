import {splitChannels, combineChannels} from "./imageutils.js";
import {hist1D, val2Bin} from "./mathutils.js";

function arrMin(arr) {
    return arr.reduce((a, b) => Math.min(a, b), Infinity);
}

function arrMax(arr) {
    return arr.reduce((a, b) => Math.max(a, b), -Infinity);
}

function normalizeRange(data, lo, hi, targetMin = 0, targetMax = 1) {
    if (hi === undefined) hi = arrMax(data);
    if (lo === undefined) lo = arrMin(data);
    const range = hi - lo;
    const scale = (targetMax - targetMin) / range;
    const output = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
        const val = Math.min(Math.max(data[i], lo), hi);
        output[i] = ((val - lo) * scale + targetMin);
    }
    return output;
}

function approxPercentileClip(data, percentileLow = 1, percentileHigh = 99, nBins=512) {
    const hist = hist1D(data, nBins, 0, 1)
    const total = data.length;
    const loThresh = (percentileLow / 100) * total;
    const hiThresh = (percentileHigh / 100) * total;

    let sum = 0, lo = 0, hi = 1;
    for (let i = 0; i < nBins; i++) {
        sum += hist[i];
        if (sum >= loThresh) { lo = i / nBins; break; }
    }
    sum = 0;
    for (let i = nBins - 1; i >= 0; i--) {
        sum += hist[i];
        if (sum >= total - hiThresh) {
            hi = i / nBins; break;
        }
    }

    return normalizeRange(data, lo, hi);
}

function stddevClip(data, sigma = 1) {
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(data.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const lo = mean - sigma * std;
    const hi = mean + sigma * std;
    return normalizeRange(data, lo, hi);
}

function minmaxClip(data, stretch = [0, 0]) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min;
    const lo = min + stretch[0] * span;
    const hi = max - stretch[1] * span;
    return normalizeRange(data, lo, hi);
}

function channelwise(data, width, height, stretchFunc, ...stretchArgs) {
    const { r, g, b, a } = splitChannels(data, width, height);
    const [rNew, gNew, bNew] = [r, g, b].map(c => stretchFunc(c, ...stretchArgs));
    return combineChannels({ r: rNew, g: gNew, b: bNew, a, width, height });
}

export {
    normalizeRange,
    approxPercentileClip,
    stddevClip,
    minmaxClip,
    channelwise
};

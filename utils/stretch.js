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

// Approximate [lo, hi] percentile values of data in [0, 1] via a histogram.
// lo is the lower edge of its bin; hi is the lower edge, or the upper edge
// if upperEdge.
function approxPercentiles(
    data, percentileLow = 1, percentileHigh = 99, nBins = 512, upperEdge = false
) {
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
            hi = (upperEdge ? i + 1 : i) / nBins; break;
        }
    }
    return [lo, hi];
}

function approxPercentileClip(data, percentileLow = 1, percentileHigh = 99, nBins=512) {
    const [lo, hi] = approxPercentiles(data, percentileLow, percentileHigh, nBins);
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

// Cumulative histograms for percentileBounds, keyed by the source pixel
// array, so a new source (a new array) gets a new histogram.
const PERCENTILE_BINS = 65536;
const cumHistCache = new WeakMap();

/**
 * Cumulative histogram of a source's finite values on [0, 1]. Float sources
 * are already normalized; 8-bit RGBA sources are read as v / 255 with the
 * alpha channel skipped. Values are clamped into the end bins, as Input
 * Stretch clamps them.
 */
function cumulativeHistogram(data, rgba8 = false) {
    let cached = cumHistCache.get(data);
    if (cached) return cached;
    const nBins = PERCENTILE_BINS;
    const hist = new Float64Array(nBins);
    const k = rgba8 ? nBins / 255 : nBins;
    let total = 0;
    for (let i = 0; i < data.length; i++) {
        if (rgba8 && (i & 3) === 3) continue;
        const v = data[i];
        if (!Number.isFinite(v)) continue;
        let ix = Math.floor(v * k);
        ix = ix < 0 ? 0 : (ix >= nBins ? nBins - 1 : ix);
        hist[ix]++;
        total++;
    }
    for (let i = 1; i < nBins; i++) hist[i] += hist[i - 1];
    cached = {cum: hist, total, nBins};
    cumHistCache.set(data, cached);
    return cached;
}

// Estimated value of the k-th smallest finite value (0-based): the bin
// holding it, with the bin's values taken as evenly spread across it.
// Within one bin of the true value.
function histOrderStat({cum, nBins}, k) {
    let lo = 0, hi = nBins - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] > k) hi = mid; else lo = mid + 1;
    }
    const before = lo > 0 ? cum[lo - 1] : 0;
    const inBin = cum[lo] - before;
    return (lo + (k - before + 0.5) / inBin) / nBins;
}

// Value at percentile p (0-100), defined as numpy.percentile's default
// ("linear"): interpolated between the order statistics either side of
// rank p/100 * (n - 1). Each order statistic is estimated from the
// histogram, so the result is within one bin (1/65536 of the normalized
// range) of numpy's, also in sparse tails where neighboring values are
// many bins apart.
function histPercentile(ch, p) {
    const rank = Math.min(Math.max(p, 0), 100) / 100 * (ch.total - 1);
    const k = Math.floor(rank);
    const lower = histOrderStat(ch, k);
    if (k + 1 >= ch.total || rank === k) return lower;
    return lower + (rank - k) * (histOrderStat(ch, k + 1) - lower);
}

/**
 * [lo, hi] values, in normalized [0, 1] source units, at percentiles pLow
 * and pHigh (0-100, any precision) of a renderer source's finite values,
 * pooled over channels. null if there is no usable source.
 * @param {{kind: string, data: ArrayLike<number>}|null|undefined} source
 */
function percentileBounds(source, pLow, pHigh) {
    if (!source?.data?.length) return null;
    const ch = cumulativeHistogram(source.data, source.kind === "rgba8");
    if (ch.total === 0) return null;
    return [histPercentile(ch, pLow), histPercentile(ch, pHigh)];
}

export {
    percentileBounds,
    PERCENTILE_BINS,
    normalizeRange,
    approxPercentiles,
    approxPercentileClip,
    stddevClip,
    minmaxClip,
    channelwise
};

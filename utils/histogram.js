// Histogram of an image as displayed: the canvas clamps values to [0, 1] and
// shows them as 8-bit levels, so there is one bin per displayed level.
// Pure: no DOM or GL dependencies.

export const HISTOGRAM_BINS = 256;

const displayedLevel = v => Math.round(Math.min(Math.max(v, 0), 1) * 255);

/**
 * @param {Float32Array} rgba interleaved RGBA pixels
 * @param {number} count number of pixels
 * @returns {{
 *   gray: boolean,         // every counted pixel shows equal R, G, B levels
 *   counts: Uint32Array[], // [gray] or [R, G, B], HISTOGRAM_BINS bins each
 *   total: number,         // pixels counted (non-NaN)
 *   below: number,         // fraction of counted pixels with a channel < 0
 *   above: number,         // fraction of counted pixels with a channel > 1
 *   nan: number,           // fraction of all pixels with a NaN channel
 * }}
 *   Out-of-range values are counted in the end bins (as displayed) and also
 *   reported in below / above; NaN pixels are excluded from the bins.
 */
export function computeHistogram(rgba, count) {
    const counts = [0, 1, 2].map(() => new Uint32Array(HISTOGRAM_BINS));
    let total = 0, below = 0, above = 0, nan = 0, gray = true;
    for (let i = 0, o = 0; i < count; i++, o += 4) {
        const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
            nan++;
            continue;
        }
        const lr = displayedLevel(r), lg = displayedLevel(g), lb = displayedLevel(b);
        counts[0][lr]++;
        counts[1][lg]++;
        counts[2][lb]++;
        if (lr !== lg || lg !== lb) gray = false;
        if (r < 0 || g < 0 || b < 0) below++;
        if (r > 1 || g > 1 || b > 1) above++;
        total++;
    }
    return {
        gray,
        counts: gray ? [counts[0]] : counts,
        total,
        below: total ? below / total : 0,
        above: total ? above / total : 0,
        nan: count ? nan / count : 0,
    };
}

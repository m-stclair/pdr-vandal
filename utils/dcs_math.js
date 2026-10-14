// Pure math for the Decorrelation Stretch effect. Mirrors marslab's
// imgops.render.decorrelation_stretch and its final stretch helpers
// (imgutils.normalize_range / enhance_color). No GL or DOM dependencies.
//
// Conventions: pixels are row vectors v = [r, g, b]; 3x3 matrices are arrays
// of rows, so out_j = sum_i v_i * T[i][j] + c[j].

/**
 * Per-chunk channel moments: count, mean, and co-moment matrix
 * M2 = sum((v - mean)ᵀ(v - mean)), from interleaved pixels. Pixels with any
 * non-finite channel are skipped. Two passes over the chunk, accumulated in
 * float64, so chunks can be merged stably with mergeMoments().
 * @param {ArrayLike<number>} data interleaved pixels
 * @param {number} count number of pixels in data
 * @param {number} [stride=4] values per pixel; channels are the first three
 * @returns {{n: number, mean: number[], M2: number[][]}}
 */
export function accumulateMoments(data, count, stride = 4) {
    let n = 0, s0 = 0, s1 = 0, s2 = 0;
    for (let i = 0, o = 0; i < count; i++, o += stride) {
        const r = data[o], g = data[o + 1], b = data[o + 2];
        if (!(Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b))) continue;
        n++;
        s0 += r;
        s1 += g;
        s2 += b;
    }
    const M2 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    if (n === 0) return {n, mean: [0, 0, 0], M2};
    const m0 = s0 / n, m1 = s1 / n, m2 = s2 / n;
    let c00 = 0, c01 = 0, c02 = 0, c11 = 0, c12 = 0, c22 = 0;
    for (let i = 0, o = 0; i < count; i++, o += stride) {
        const r = data[o], g = data[o + 1], b = data[o + 2];
        if (!(Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b))) continue;
        const d0 = r - m0, d1 = g - m1, d2 = b - m2;
        c00 += d0 * d0;
        c01 += d0 * d1;
        c02 += d0 * d2;
        c11 += d1 * d1;
        c12 += d1 * d2;
        c22 += d2 * d2;
    }
    M2[0] = [c00, c01, c02];
    M2[1] = [c01, c11, c12];
    M2[2] = [c02, c12, c22];
    return {n, mean: [m0, m1, m2], M2};
}

/**
 * Combine two moment sets (Chan et al. parallel update).
 * @returns {{n: number, mean: number[], M2: number[][]}}
 */
export function mergeMoments(a, b) {
    if (a.n === 0) return b;
    if (b.n === 0) return a;
    const n = a.n + b.n;
    const d = [0, 1, 2].map(i => b.mean[i] - a.mean[i]);
    const mean = [0, 1, 2].map(i => a.mean[i] + d[i] * b.n / n);
    const w = a.n * b.n / n;
    const M2 = [0, 1, 2].map(i => [0, 1, 2].map(
        j => a.M2[i][j] + b.M2[i][j] + d[i] * d[j] * w
    ));
    return {n, mean, M2};
}

/**
 * Mean and sample covariance (ddof = 1, as np.ma.cov).
 * @returns {{count: number, mean: number[], cov: number[][]}}
 */
export function finalizeMoments({n, mean, M2}) {
    const denom = n > 1 ? n - 1 : 1;
    return {count: n, mean, cov: M2.map(row => row.map(v => v / denom))};
}

/**
 * Statistics of u = A·x + B (scalar A, B applied to every channel) from
 * statistics of x.
 * @returns {{count: number, mean: number[], cov: number[][]}}
 */
export function scaleStats({count, mean, cov}, A, B) {
    return {
        count,
        mean: mean.map(m => A * m + B),
        cov: cov.map(row => row.map(v => A * A * v)),
    };
}

/**
 * Re-express out = uT + c, defined on u = A·x + B, as a transform of x:
 * out = x(A·T) + (c + B·(1ᵀT)).
 * @returns {{T: number[][], c: number[]}}
 */
export function transformToInputUnits({T, c}, A, B) {
    return {
        T: T.map(row => row.map(v => A * v)),
        c: c.map((cj, j) => cj + B * (T[0][j] + T[1][j] + T[2][j])),
    };
}

/**
 * Eigendecomposition of a symmetric 3x3 matrix by cyclic Jacobi rotations.
 * @param {number[][]} A symmetric matrix (not modified)
 * @returns {{values: number[], vectors: number[][]}} vectors[i][k] is
 *   component i of the eigenvector for values[k] (eigenvectors are columns)
 */
export function jacobiEigen3(A) {
    const a = A.map(row => row.slice());
    const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let sweep = 0; sweep < 50; sweep++) {
        const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2;
        const diag = a[0][0] ** 2 + a[1][1] ** 2 + a[2][2] ** 2;
        if (off <= 1e-30 * diag || off === 0) break;
        for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
            if (a[p][q] === 0) continue;
            const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
            const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
            const c = 1 / Math.sqrt(t * t + 1);
            const s = t * c;
            for (let k = 0; k < 3; k++) {
                const akp = a[k][p], akq = a[k][q];
                a[k][p] = c * akp - s * akq;
                a[k][q] = s * akp + c * akq;
            }
            for (let k = 0; k < 3; k++) {
                const apk = a[p][k], aqk = a[q][k];
                a[p][k] = c * apk - s * aqk;
                a[q][k] = s * apk + c * aqk;
            }
            for (let k = 0; k < 3; k++) {
                const vkp = v[k][p], vkq = v[k][q];
                v[k][p] = c * vkp - s * vkq;
                v[k][q] = s * vkp + c * vkq;
            }
        }
    }
    return {values: [a[0][0], a[1][1], a[2][2]], vectors: v};
}

// Eigenvalues at or below this fraction of the covariance trace are treated
// as singular (e.g. a gray image with three identical bands).
const SINGULAR_TOLERANCE = 1e-12;

/**
 * DCS transform before the final stretch: out = vT + c.
 * T = E diag(1/sqrt(λ)) Eᵀ, then scaled by the target sigma: per-channel
 * input standard deviation when sigma is null (marslab sigma=None), or a
 * scalar otherwise. c folds in marslab's mean restore and offset term:
 * (v - μ)T + μ + (μ - μT) = vT + 2μ - 2μT.
 * @param {{count: number, mean: number[], cov: number[][]}} stats
 * @param {number|null} sigma
 * @returns {{T: number[][], c: number[]}|null} null when there are fewer
 *   than two valid pixels or the covariance is singular
 */
export function dcsTransform({count, mean, cov}, sigma) {
    if (count < 2) return null;
    const trace = cov[0][0] + cov[1][1] + cov[2][2];
    if (!(trace > 0) || !Number.isFinite(trace)) return null;
    const {values, vectors: E} = jacobiEigen3(cov);
    if (values.some(l => !(l > SINGULAR_TOLERANCE * trace))) return null;
    const inv = values.map(l => 1 / Math.sqrt(l));
    const T = [0, 1, 2].map(i => [0, 1, 2].map(j => {
        let sum = 0;
        for (let k = 0; k < 3; k++) sum += E[i][k] * inv[k] * E[j][k];
        return sum;
    }));
    const scale = sigma === null
        ? [0, 1, 2].map(j => Math.sqrt(cov[j][j]))
        : [sigma, sigma, sigma];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) T[i][j] *= scale[j];
    }
    const c = [0, 1, 2].map(j => {
        let muT = 0;
        for (let i = 0; i < 3; i++) muT += mean[i] * T[i][j];
        return 2 * mean[j] - 2 * muT;
    });
    return {T, c};
}

/**
 * Apply out = vT + c to interleaved pixels, writing three channels per
 * pixel to out (non-finite inputs give NaN).
 * @returns {Float64Array} out
 */
export function applyTransform(data, count, {T, c}, stride = 4, out = new Float64Array(count * 3)) {
    for (let i = 0, o = 0; i < count; i++, o += stride) {
        const r = data[o], g = data[o + 1], b = data[o + 2];
        for (let j = 0; j < 3; j++) {
            out[i * 3 + j] = r * T[0][j] + g * T[1][j] + b * T[2][j] + c[j];
        }
    }
    return out;
}

/**
 * Percentile of ascending-sorted values with numpy's default (linear)
 * interpolation.
 * @param {ArrayLike<number>} sorted
 * @param {number} p in [0, 100]
 */
export function percentileFromSorted(sorted, p) {
    const n = sorted.length;
    if (n === 0) return NaN;
    const idx = (p / 100) * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, n - 1);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Ranks needed for numpy's linear-interpolated percentile p of n sorted
 * values: the value is v[k0] + (v[k1] - v[k0]) * frac.
 * @returns {{k0: number, k1: number, frac: number}}
 */
export function percentileRanks(n, p) {
    const idx = (p / 100) * (n - 1);
    const k0 = Math.floor(idx);
    return {k0, k1: Math.min(k0 + 1, n - 1), frac: idx - k0};
}

/**
 * Bin of a histogram holding the value of 0-based ascending rank `rank`,
 * and how many values lie in lower bins. With those, an exact selection
 * needs only the values in that one bin: v[rank] is element
 * (rank - below) of the bin's sorted values.
 * @param {ArrayLike<number>} hist bin counts
 * @returns {{bin: number, below: number}}
 */
export function locateRank(hist, rank) {
    let below = 0;
    for (let b = 0; b < hist.length; b++) {
        if (below + hist[b] > rank) return {bin: b, below};
        below += hist[b];
    }
    throw new RangeError(`rank ${rank} exceeds histogram total ${below}`);
}

/**
 * Fold the DCS transform and final linear stretch into one affine map,
 * final = vM + b, M = T·D, b = (c - lo)·D, D = diag(1 / (hi - lo)).
 * @param {{T: number[][], c: number[]}} transform
 * @param {number[]} lo per-channel lower bounds of out
 * @param {number[]} hi per-channel upper bounds of out
 * @returns {{cols: number[][], b: number[]}|null} cols[j] is column j of M;
 *   null if any channel's range is empty or non-finite
 */
export function foldAffine({T, c}, lo, hi) {
    const scale = [0, 1, 2].map(j => 1 / (hi[j] - lo[j]));
    if (scale.some(s => !(s > 0) || !Number.isFinite(s))) return null;
    const cols = [0, 1, 2].map(j => [0, 1, 2].map(i => T[i][j] * scale[j]));
    const b = [0, 1, 2].map(j => (c[j] - lo[j]) * scale[j]);
    return {cols, b};
}

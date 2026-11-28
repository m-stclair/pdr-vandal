// Crop / rebin / flip / rotate for PDR products, applied to the data in
// Python (pdrview.Geometry) before scaling, so statistics and clip modes see
// the transformed array. Order: crop (original pixel coordinates) -> rebin
// (integer block mean) -> flip left-right -> rotate quarter turns clockwise.
// This module holds the pure bookkeeping the UI needs: orientation
// composition, output size, mapping displayed pixels back to original ones.
//
// The user never chooses `bin`: the geometry the UI keeps is crop and
// orientation only, and withAutoBin adds the smallest rebin that lets the
// cropped array fit in one texture (1 when it already fits). Geometries
// returned from Python are "resolved" and carry that bin.

/**
 * @typedef {{x0: number, y0: number, width: number, height: number,
 *   bin: number, flip: boolean, rot: number}} Geometry
 */

/** Whole w x h array, unchanged. */
export function identityGeometry(w, h) {
    return {x0: 0, y0: 0, width: w, height: h, bin: 1, flip: false, rot: 0};
}

export function isIdentity(g, w, h) {
    return !g || (g.x0 === 0 && g.y0 === 0 && g.width === w && g.height === h &&
        g.bin === 1 && !g.flip && g.rot % 4 === 0);
}

/** Clamp to a w x h array, as pdrview.Geometry.resolved does; a missing
 * width / height means "to the edge". */
export function clampGeometry(g, w, h) {
    const int = (v, d) => (v === null || v === undefined || !Number.isFinite(Number(v)))
        ? d : Math.trunc(Number(v));
    const x0 = Math.min(Math.max(int(g.x0, 0), 0), w - 1);
    const y0 = Math.min(Math.max(int(g.y0, 0), 0), h - 1);
    const width = Math.min(Math.max(int(g.width, w), 1), w - x0);
    const height = Math.min(Math.max(int(g.height, h), 1), h - y0);
    const bin = Math.min(Math.max(int(g.bin, 1), 1), width, height);
    return {x0, y0, width, height, bin, flip: Boolean(g.flip), rot: ((int(g.rot, 0) % 4) + 4) % 4};
}

/** [width, height] of the transformed array. */
export function outputSize(g) {
    const w = Math.floor(g.width / g.bin), h = Math.floor(g.height / g.bin);
    return g.rot % 2 ? [h, w] : [w, h];
}

// Orientations as 2x2 integer matrices acting on (x, y) display vectors,
// y down. FLIP mirrors left-right; ROT turns a quarter clockwise, taking
// right (1, 0) to down (0, 1).
const mul = (a, b) => [
    a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
];
const FLIP_H = [-1, 0, 0, 1];
const FLIP_V = [1, 0, 0, -1];
const ROT_CW = [0, -1, 1, 0];
const ROT_CCW = [0, 1, -1, 0];
const OPS = {cw: ROT_CW, ccw: ROT_CCW, flipH: FLIP_H, flipV: FLIP_V};

function orientationMatrix(flip, rot) {
    let m = flip ? FLIP_H : [1, 0, 0, 1];
    for (let i = 0; i < rot % 4; i++) m = mul(ROT_CW, m);
    return m;
}

/**
 * The {flip, rot} that results from applying `op` ("cw", "ccw", "flipH",
 * "flipV", as seen on screen) after the current orientation.
 */
export function composeOrientation(g, op) {
    const target = mul(OPS[op], orientationMatrix(g.flip, g.rot));
    for (const flip of [false, true]) {
        for (let rot = 0; rot < 4; rot++) {
            if (orientationMatrix(flip, rot).every((v, i) => v === target[i])) {
                return {...g, flip, rot};
            }
        }
    }
    throw new Error(`unreachable orientation for ${op}`);
}

/**
 * Original-array pixel block that a pixel (x, y) of the transformed array
 * came from: {x0, y0, x1, y1}, inclusive; a single pixel unless rebinned.
 */
export function toOriginalPixel(g, x, y) {
    let [w, h] = outputSize(g);
    for (let i = 0; i < g.rot % 4; i++) {
        // undo one clockwise quarter turn of a (h x w) -> (w x h) array
        [x, y] = [y, w - 1 - x];
        [w, h] = [h, w];
    }
    if (g.flip) x = w - 1 - x;
    const ox = g.x0 + x * g.bin, oy = g.y0 + y * g.bin;
    return {x0: ox, y0: oy, x1: ox + g.bin - 1, y1: oy + g.bin - 1};
}

/**
 * Geometry cropping a transformed array's uv rect {u0, u1, v0, v1} (as
 * displayed, row 0 at top), expressed in original pixels and keeping the
 * current bin and orientation.
 */
export function cropToRegion(g, region) {
    const [w, h] = outputSize(g);
    const xa = Math.floor(region.u0 * w), xb = Math.max(xa, Math.ceil(region.u1 * w) - 1);
    const ya = Math.floor(region.v0 * h), yb = Math.max(ya, Math.ceil(region.v1 * h) - 1);
    const corners = [[xa, ya], [xb, ya], [xa, yb], [xb, yb]].map(([x, y]) => toOriginalPixel(g, x, y));
    const x0 = Math.min(...corners.map(c => c.x0)), x1 = Math.max(...corners.map(c => c.x1));
    const y0 = Math.min(...corners.map(c => c.y0)), y1 = Math.max(...corners.map(c => c.y1));
    return {...g, x0, y0, width: x1 - x0 + 1, height: y1 - y0 + 1};
}

/** Smallest bin factor that brings a w x h array within maxDim. */
export function binToFit(w, h, maxDim) {
    return Math.max(1, Math.ceil(Math.max(w, h) / maxDim));
}

/** `g` with the bin its crop needs to fit within maxDim (see binToFit). */
export function withAutoBin(g, maxDim) {
    return {...g, bin: binToFit(g.width, g.height, maxDim)};
}

/** `g` without a bin, as the UI stores it (the bin is re-derived on load). */
export function withoutBin(g) {
    return {...g, bin: 1};
}

/** New undo stack with `g` pushed, keeping only the newest `cap` entries. */
export function pushHistory(stack, g, cap = 10) {
    const next = [...stack, g];
    return next.length > cap ? next.slice(next.length - cap) : next;
}

/**
 * Apply a resolved geometry to a single-band w x h Float32Array in JS, as
 * pdrview.apply_geometry does in Python: crop, mean rebin (non-finite pixels
 * ignored; a block with none valid is NaN; partial edge blocks dropped),
 * flip left-right, rotate quarter turns clockwise. Returns
 * {pixels, width, height}. Used for arrays made in the browser (the test
 * pattern), which never pass through Python.
 */
export function applyGeometryToArray(pixels, w, h, g) {
    const b = g.bin;
    const bw = Math.floor(g.width / b), bh = Math.floor(g.height / b);
    // crop + rebin
    const binned = new Float32Array(bw * bh);
    for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
            let sum = 0, n = 0;
            for (let dy = 0; dy < b; dy++) {
                const row = (g.y0 + by * b + dy) * w + g.x0 + bx * b;
                for (let dx = 0; dx < b; dx++) {
                    const v = pixels[row + dx];
                    if (Number.isFinite(v)) { sum += v; n++; }
                }
            }
            binned[by * bw + bx] = n ? sum / n : NaN;
        }
    }
    // flip + rotate: fill each output pixel from the binned array, using
    // toOriginalPixel's inverse mapping on a bin-1, uncropped geometry
    const view = {x0: 0, y0: 0, width: bw, height: bh, bin: 1, flip: g.flip, rot: g.rot};
    const [ow, oh] = outputSize(view);
    if (!g.flip && g.rot % 4 === 0) return {pixels: binned, width: ow, height: oh};
    const out = new Float32Array(ow * oh);
    for (let y = 0; y < oh; y++) {
        for (let x = 0; x < ow; x++) {
            const o = toOriginalPixel(view, x, y);
            out[y * ow + x] = binned[o.y0 * bw + o.x0];
        }
    }
    return {pixels: out, width: ow, height: oh};
}

/** Short filename tag, e.g. "crop10-20-300x200_bin2_flip_rot90"; "" for identity. */
export function geometrySuffix(g, w, h) {
    if (isIdentity(g, w, h)) return "";
    const parts = [];
    if (g.x0 !== 0 || g.y0 !== 0 || g.width !== w || g.height !== h) {
        parts.push(`crop${g.x0}-${g.y0}-${g.width}x${g.height}`);
    }
    if (g.bin > 1) parts.push(`bin${g.bin}`);
    if (g.flip) parts.push("flip");
    if (g.rot % 4) parts.push(`rot${90 * (g.rot % 4)}`);
    return parts.join("_");
}

/**
 * Why a geometry may break a Bayer mosaic, or null: rebinning mixes the
 * color sites, and an odd crop offset, a flip or a rotation changes which
 * site comes first, so the Debayer pattern no longer matches.
 */
export function bayerWarning(g) {
    const issues = [];
    if (g.bin > 1) issues.push("rebinning mixes the color sites");
    if (g.x0 % 2 || g.y0 % 2) issues.push("an odd crop offset shifts the pattern");
    if (g.flip || g.rot % 4) issues.push("flip / rotation changes the pattern");
    return issues.length ? `Debayer: ${issues.join("; ")}.` : null;
}

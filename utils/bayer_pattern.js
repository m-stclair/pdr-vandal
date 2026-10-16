// Simulated raw Bayer (RGGB) test image for the Debayer effect: a composite
// chart (color patches, zone plate, hue wheel + gray ramp, edges and line
// pairs) sampled through an RGGB color filter array with a green-heavy color
// cast and sensor noise, like an unprocessed raw frame. Pure: no DOM or GL.

import {hsv2Rgb} from "./colorutils.js";

// Macbeth-style 24-patch chart, sRGB 8-bit, row-major (4 rows of 6).
const CHART_PATCHES = [
    [115, 82, 68], [194, 150, 130], [98, 122, 157], [87, 108, 67], [133, 128, 177], [103, 189, 170],
    [214, 126, 44], [80, 91, 166], [193, 90, 99], [94, 60, 108], [157, 188, 64], [224, 163, 46],
    [56, 61, 150], [70, 148, 73], [175, 54, 60], [231, 199, 31], [187, 86, 149], [8, 133, 161],
    [243, 243, 242], [200, 200, 200], [160, 160, 160], [122, 122, 121], [85, 85, 85], [52, 52, 52],
];

// Ideal values are display-referred (the pipeline applies no gamma) and
// mapped into [LIFT_LO, LIFT_HI], leaving headroom like a real raw so that
// cast and noise don't clip at 0 or 1.
const LIFT_LO = 0.08;
const LIFT_HI = 0.90;
const lift = v => LIFT_LO + (LIFT_HI - LIFT_LO) * v;

const BACKGROUND = 0.12;
const DARK = 0.1;
const LIGHT = 0.9;
const SLANT = Math.tan(5 * Math.PI / 180);

// CFA channel (0 = R, 1 = G, 2 = B) at (x, y) for RGGB: R at even row and
// even column, B at odd row and odd column. Matches CELL_CLASSES[RGGB] in
// effects/debayer.js.
export function rggbChannel(x, y) {
    return (y & 1) === 0 ? ((x & 1) === 0 ? 0 : 1) : ((x & 1) === 0 ? 1 : 2);
}

function setGray(out, v) {
    out[0] = out[1] = out[2] = v;
}

// Top-left: the 24-patch chart on a dark background.
function colorChart(lx, ly, s, out) {
    const pitch = 160 * s, size = 140 * s, x0 = 32 * s, y0 = 32 * s;
    const col = Math.floor((lx - x0) / pitch), row = Math.floor((ly - y0) / pitch);
    const inPatch = col >= 0 && col < 6 && row >= 0 && row < 4
        && (lx - x0) - col * pitch < size && (ly - y0) - row * pitch < size;
    if (!inPatch) return setGray(out, BACKGROUND);
    const [r, g, b] = CHART_PATCHES[row * 6 + col];
    out[0] = r / 255;
    out[1] = g / 255;
    out[2] = b / 255;
}

// Top-right: neutral circular zone plate. Spatial frequency k·r/π reaches
// Nyquist (0.5 cycles/px) at the rim, so the ideal image itself never
// aliases; any color in a demosaicked result is false color.
function zonePlate(lx, ly, q, out) {
    const R = q / 2;
    const dx = lx - R + 0.5, dy = ly - R + 0.5;
    const r2 = dx * dx + dy * dy;
    if (r2 > R * R) return setGray(out, 0.5);
    setGray(out, 0.5 + 0.45 * Math.cos((Math.PI / (2 * R)) * r2));
}

// Bottom-left: hue wheel (hue by angle, saturation by radius) above a gray
// ramp strip.
function hueWheelAndRamp(lx, ly, s, out) {
    const cx = 512 * s, cy = 430 * s, R = 380 * s;
    const dx = lx - cx, dy = ly - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < R) {
        const hue = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
        const [r, g, b] = hsv2Rgb(hue, d / R, 1);
        out[0] = r;
        out[1] = g;
        out[2] = b;
        return;
    }
    const rx0 = 64 * s, rx1 = 960 * s;
    if (ly >= 880 * s && ly < 980 * s && lx >= rx0 && lx < rx1) {
        return setGray(out, (lx - rx0) / (rx1 - rx0));
    }
    setGray(out, BACKGROUND);
}

// Bottom-right: slanted edge, line pairs (1-3 px lines), and colored edges.
function edgesAndLines(lx, ly, q, out) {
    const h = q / 2;
    if (ly < h) {
        if (lx < h) {
            // ~5° slanted dark/light edge through the tile center.
            const t = (lx - h / 2) - SLANT * (ly - h / 2);
            return setGray(out, t >= 0 ? LIGHT : DARK);
        }
        // Three bands of 1, 2 and 3 px lines: vertical lines on the left,
        // horizontal on the right.
        const band = Math.min(2, Math.floor(ly / (h / 3)));
        const w = band + 1;
        const coord = lx < h + h / 2 ? lx : ly;
        return setGray(out, Math.floor(coord / w) % 2 ? LIGHT : DARK);
    }
    // Colored edges: red|blue and green|magenta, vertical above, horizontal
    // below.
    const pairs = lx < h
        ? [[0.9, 0.1, 0.1], [0.1, 0.1, 0.9]]
        : [[0.1, 0.9, 0.1], [0.9, 0.1, 0.9]];
    const vertical = ly < h + h / 2;
    const first = vertical ? (lx % h) < h / 2 : (ly - h - h / 2) < h / 4;
    const c = pairs[first ? 0 : 1];
    out[0] = c[0];
    out[1] = c[1];
    out[2] = c[2];
}

/**
 * Ideal (pre-sensor) color of pixel (x, y) of a size x size chart, written
 * to out as [r, g, b] in [LIFT_LO, LIFT_HI]. Row 0 is the image top.
 * @param {number[]} [out]
 * @returns {number[]} out
 */
export function idealChartRGB(x, y, size, out = [0, 0, 0]) {
    const q = size / 2;
    const s = q / 1024;
    const lx = x % q, ly = y % q;
    if (y < q) {
        if (x < q) colorChart(lx, ly, s, out);
        else zonePlate(lx, ly, q, out);
    } else if (x < q) {
        hueWheelAndRamp(lx, ly, s, out);
    } else {
        edgesAndLines(lx, ly, q, out);
    }
    for (let c = 0; c < 3; c++) out[c] = lift(out[c]);
    return out;
}

// mulberry32: small seeded PRNG, so the pattern is reproducible.
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Simulated raw RGGB mosaic of the test chart: per-channel cast gains, then
 * additive Gaussian noise, then CFA sampling, clamped to [0, 1].
 * @param {number} [size=2048] image edge in pixels (even)
 * @param {{gains?: number[], noise?: number, seed?: number}} [options]
 * @returns {Float32Array} size x size single-band mosaic, row-major
 */
export function makeBayerTestMosaic(size = 2048, {
    gains = [0.5, 1.0, 0.7], noise = 0.01, seed = 1,
} = {}) {
    const mosaic = new Float32Array(size * size);
    const rand = mulberry32(seed);
    const gauss = () => {
        const u = 1 - rand();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
    };
    const rgb = [0, 0, 0];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            idealChartRGB(x, y, size, rgb);
            const c = rggbChannel(x, y);
            const v = rgb[c] * gains[c] + (noise ? noise * gauss() : 0);
            mosaic[y * size + x] = Math.min(1, Math.max(0, v));
        }
    }
    return mosaic;
}

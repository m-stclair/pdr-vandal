import {clamp} from "./mathutils.js";

function splitChannels(data, width, height) {
    const size = width * height;
    const r = new Float32Array(size);
    const g = new Float32Array(size);
    const b = new Float32Array(size);
    const a = new Float32Array(size);

    for (let i = 0; i < size; i++) {
        r[i] = data[i * 4];
        g[i] = data[i * 4 + 1];
        b[i] = data[i * 4 + 2];
        a[i] = data[i * 4 + 3];
    }

    return {r, g, b, a};
}

function combineChannels({r, g, b, a, width, height}) {
    const output = new Float32Array(width * height * 4);

    for (let i = 0; i < width * height; i++) {
        output[i * 4] = r[i];
        output[i * 4 + 1] = g[i];
        output[i * 4 + 2] = b[i];
        output[i * 4 + 3] = a ? a[i] : 1;
    }
    return output;
}

function normalizeImageData({data, width, height}) {
    return {
        data: Float32Array.from(data, x => x / 255),
        width,
        height
    };
}

function deNormalizeImageData(norm, width, height) {
    const len = norm.length;
    const out = new Uint8ClampedArray(len);
    const scale = 255;
    for (let i = 0; i < len; i++) {
        out[i] = norm[i] * scale + 0.5 | 0; // bitwise round
    }
    return new ImageData(out, width, height);
}

function deNormalizeToBytes(norm) {
    const len = norm.length;
    const out = new Uint8ClampedArray(len);
    for (let i = 0; i < len; i++) {
        out[i] = norm[i] * 255 + 0.5 | 0;  // fast rounding, clamp handled
    }
    return out;
}

function float32ToUint8Array(f32) {
    const len = f32.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; ++i) {
        const v = f32[i];
        u8[i] = v >= 1 ? 255 : v <= 0 ? 0 : (v * 255) | 0;
    }
    return u8;
}


export {
    splitChannels,
    combineChannels,
    normalizeImageData,
    deNormalizeImageData,
    deNormalizeToBytes,
    float32ToUint8Array
};
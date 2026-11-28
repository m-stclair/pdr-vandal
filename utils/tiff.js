// Minimal baseline TIFF writer: uncompressed, chunky, little-endian, 8 or
// 16 bits per sample, 1-4 samples per pixel. Input is float RGBA in [0, 1]
// (what GlitchRenderer.createExport returns); values are clamped, NaN -> 0.

const STRIP_TARGET_BYTES = 8 * 1024 * 1024;
const MAX_FILE_BYTES = 0xFFFFFFFF; // classic TIFF uses 32-bit offsets

const TYPE_SIZES = {ASCII: 1, SHORT: 2, LONG: 4};

/**
 * Decide how many samples per pixel the output needs.
 * @param {Float32Array} pixels RGBA
 * @param {number} sourceBands band count of the input data (1 = grayscale)
 * @returns {{color: number, alpha: boolean, channels: number}} color is 1 or 3
 */
export function analyzeChannels(pixels, sourceBands) {
    let gray = sourceBands === 1;
    let alpha = false;
    const normalized = v => v > 0 ? Math.min(v, 1) : 0;
    for (let i = 0; i < pixels.length; i += 4) {
        if (gray && (normalized(pixels[i]) !== normalized(pixels[i + 1]) || normalized(pixels[i]) !== normalized(pixels[i + 2]))) {
            gray = false;
        }
        if (!(pixels[i + 3] >= 1)) alpha = true;
        if (!gray && alpha) break;
    }
    const color = gray ? 1 : 3;
    return {color, alpha, channels: color + (alpha ? 1 : 0)};
}

function ifdEntry(tag, type, values) {
    const list = typeof values === "number" ? [values] : values;
    return {tag, type, count: list.length, bytes: TYPE_SIZES[type] * list.length, values: list};
}

function writeValues(view, offset, type, values) {
    values.forEach((v, i) => {
        if (type === "ASCII") view.setUint8(offset + i, v);
        else if (type === "SHORT") view.setUint16(offset + 2 * i, v, true);
        else view.setUint32(offset + 4 * i, v, true);
    });
}

function buildMetadata(entries, ifdOffset) {
    entries.sort((a, b) => a.tag - b.tag);
    const ifdSize = 2 + entries.length * 12 + 4;
    let extra = ifdSize;
    for (const e of entries) {
        if (e.bytes > 4) {
            e.external = extra;
            extra += e.bytes + (e.bytes & 1);
        }
    }
    const buffer = new ArrayBuffer(extra);
    const view = new DataView(buffer);
    view.setUint16(0, entries.length, true);
    entries.forEach((e, i) => {
        const at = 2 + i * 12;
        view.setUint16(at, e.tag, true);
        view.setUint16(at + 2, {ASCII: 2, SHORT: 3, LONG: 4}[e.type], true);
        view.setUint32(at + 4, e.count, true);
        if (e.bytes > 4) {
            view.setUint32(at + 8, ifdOffset + e.external, true);
            writeValues(view, e.external, e.type, e.values);
        } else {
            writeValues(view, at + 8, e.type, e.values);
        }
    });
    view.setUint32(2 + entries.length * 12, 0, true); // no next IFD
    return buffer;
}

/**
 * @param {object} o
 * @param {Float32Array} o.pixels RGBA float, row 0 at the top
 * @param {number} o.w
 * @param {number} o.h
 * @param {8|16} o.bits
 * @param {number} o.sourceBands 1 for grayscale input, else 3
 * @param {string} [o.description] stored in ImageDescription
 * @returns {{blob: Blob, channels: number}}
 */
export function encodeTiff({pixels, w, h, bits, sourceBands, description = ""}) {
    if (bits !== 8 && bits !== 16) throw new Error(`unsupported bit depth ${bits}`);
    if (pixels.length !== w * h * 4) throw new Error("pixel buffer does not match dimensions");
    const {color, alpha, channels} = analyzeChannels(pixels, sourceBands);
    const bytesPer = bits / 8;
    const rowBytes = w * channels * bytesPer;
    const dataBytes = rowBytes * h;
    if (8 + dataBytes + 4096 + description.length > MAX_FILE_BYTES) {
        throw new Error(
            "Image is too large for a TIFF file (4 GB limit). Export the view or use PNG."
        );
    }
    const rowsPerStrip = Math.max(1, Math.min(h, Math.floor(STRIP_TARGET_BYTES / rowBytes)));
    const max = bits === 8 ? 255 : 65535;
    const Ctor = bits === 8 ? Uint8Array : Uint16Array;
    if (bits === 16 && new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {
        throw new Error("16-bit TIFF export requires a little-endian host");
    }

    const header = new ArrayBuffer(8);
    const hv = new DataView(header);
    hv.setUint8(0, 0x49); hv.setUint8(1, 0x49); // "II"
    hv.setUint16(2, 42, true);

    const parts = [header];
    const offsets = [];
    const counts = [];
    let cursor = 8;
    for (let y0 = 0; y0 < h; y0 += rowsPerStrip) {
        const rows = Math.min(rowsPerStrip, h - y0);
        const strip = new Ctor(rows * w * channels);
        let o = 0;
        for (let i = y0 * w * 4, end = (y0 + rows) * w * 4; i < end; i += 4) {
            for (let c = 0; c < channels; c++) {
                // Gray output reads the R channel; alpha is always last.
                const src = (alpha && c === channels - 1) ? 3 : (color === 1 ? 0 : c);
                const v = pixels[i + src];
                strip[o++] = v > 0 ? (v < 1 ? Math.round(v * max) : max) : 0;
            }
        }
        offsets.push(cursor);
        counts.push(strip.byteLength);
        cursor += strip.byteLength;
        parts.push(strip);
    }
    // Pad to a word boundary: the IFD must start on one.
    if (cursor & 1) {
        parts.push(new Uint8Array(1));
        cursor += 1;
    }

    const desc = Array.from(new TextEncoder().encode(description + "\0"));
    const entries = [
        ifdEntry(256, "LONG", w),
        ifdEntry(257, "LONG", h),
        ifdEntry(258, "SHORT", new Array(channels).fill(bits)),
        ifdEntry(259, "SHORT", 1),
        ifdEntry(262, "SHORT", color === 1 ? 1 : 2),
        ifdEntry(273, "LONG", offsets),
        ifdEntry(277, "SHORT", channels),
        ifdEntry(278, "LONG", rowsPerStrip),
        ifdEntry(279, "LONG", counts),
        ifdEntry(284, "SHORT", 1),
    ];
    if (description) entries.push(ifdEntry(270, "ASCII", desc));
    if (alpha) entries.push(ifdEntry(338, "SHORT", 2)); // unassociated alpha
    const meta = buildMetadata(entries, cursor);
    if (cursor + meta.byteLength > MAX_FILE_BYTES) {
        throw new Error("Image is too large for a TIFF file (4 GB limit).");
    }
    hv.setUint32(4, cursor, true); // IFD offset
    parts.push(meta);
    return {blob: new Blob(parts, {type: "image/tiff"}), channels};
}

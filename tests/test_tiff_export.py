"""TIFF export: the encoder's output parsed back, and the export precision."""
import base64
import io
import struct

import numpy as np
import pytest
from PIL import Image

from reference.fixtures import correlated_dn, pdr_normalize

_ENCODE = """
const {encodeTiff} = await import('/utils/tiff.js');
const px = __b64dec(arg.data, Float32Array);
const {blob, channels} = encodeTiff({pixels: px, w: arg.w, h: arg.h,
    bits: arg.bits, sourceBands: arg.bands, description: 'hello'});
return {channels, data: __b64enc(new Uint8Array(await blob.arrayBuffer()))};
"""


def parse_tiff(raw):
    """Minimal independent baseline-TIFF reader -> (array, tags)."""
    assert raw[:4] == b"II*\x00"
    (ifd,) = struct.unpack_from("<I", raw, 4)
    (n,) = struct.unpack_from("<H", raw, ifd)
    sizes = {3: 2, 4: 4, 2: 1}
    tags = {}
    for i in range(n):
        tag, typ, count, val = struct.unpack_from("<HHII", raw, ifd + 2 + 12 * i)
        size = sizes[typ] * count
        at = ifd + 2 + 12 * i + 8
        if size > 4:
            at = val
        fmt = {3: "H", 4: "I", 2: "B"}[typ]
        tags[tag] = struct.unpack_from(f"<{count}{fmt}", raw, at)
    spp, bits = tags[277][0], tags[258][0]
    assert set(tags[258]) == {bits} and len(tags[258]) == spp
    w, h = tags[256][0], tags[257][0]
    data = b"".join(
        raw[o:o + c] for o, c in zip(tags[273], tags[279])
    )
    arr = np.frombuffer(data, dtype="<u2" if bits == 16 else "u1")
    return arr.reshape(h, w, spp), tags


def encode(app, rgba, bits, bands):
    h, w = rgba.shape[:2]
    out = app.js(_ENCODE, {
        "data": base64.b64encode(rgba.astype(np.float32).tobytes()).decode(),
        "w": w, "h": h, "bits": bits, "bands": bands,
    })
    return out["channels"], base64.b64decode(out["data"])


def _quant(values, maxv):
    """Round half up in float64, as the encoder's Math.round does."""
    return np.floor(values.astype(np.float64) * maxv + 0.5)


def _rgba(rgb, alpha=1.0):
    h, w = rgb.shape[:2]
    out = np.ones((h, w, 4), np.float32) * alpha
    out[..., :3] = rgb if rgb.ndim == 3 else rgb[..., None]
    return out


@pytest.mark.parametrize("bits", [8, 16])
def test_gray_and_rgb_round_trip(app, bits):
    rng = np.random.default_rng(0)
    maxv = 2 ** bits - 1
    gray = rng.random((37, 53)).astype(np.float32)
    ch, raw = encode(app, _rgba(gray), bits, 1)
    arr, tags = parse_tiff(raw)
    assert ch == 1 and arr.shape == (37, 53, 1) and tags[262] == (1,)
    assert bytes(tags[270]).startswith(b"hello")
    np.testing.assert_array_equal(arr[..., 0], _quant(gray, maxv))

    rgb = rng.random((9, 11, 3)).astype(np.float32)
    ch, raw = encode(app, _rgba(rgb), bits, 3)
    arr, tags = parse_tiff(raw)
    assert ch == 3 and tags[262] == (2,) and 338 not in tags
    np.testing.assert_array_equal(arr, _quant(rgb, maxv))


def test_gray_source_with_colored_pixels_stays_rgb(app):
    rgb = np.random.default_rng(1).random((5, 6, 3)).astype(np.float32)
    ch, _ = encode(app, _rgba(rgb), 8, 1)
    assert ch == 3


def test_rgb_source_with_gray_pixels_stays_rgb(app):
    ch, _ = encode(app, _rgba(np.full((4, 4), 0.5, np.float32)), 8, 3)
    assert ch == 3


def test_alpha_kept_when_not_opaque(app):
    rgba = _rgba(np.full((4, 4), 0.5, np.float32))
    rgba[0, 0, 3] = 0.0
    ch, raw = encode(app, rgba, 8, 3)
    arr, tags = parse_tiff(raw)
    assert ch == 4 and tags[338] == (2,) and arr[0, 0, 3] == 0


def test_clamps_and_nan(app):
    vals = np.array([[-1.0, 0.0, 1.0, 2.0, np.nan]], np.float32)
    _, raw = encode(app, _rgba(vals), 8, 1)
    arr, _ = parse_tiff(raw)
    assert arr[0, :, 0].tolist() == [0, 0, 255, 255, 0]


def test_multiple_strips_and_pillow_reads_it(app):
    # > 8 MB of pixel data forces several strips.
    h, w = 2100, 2100
    gray = np.linspace(0, 1, h * w, dtype=np.float32).reshape(h, w)
    _, raw = encode(app, _rgba(gray), 16, 1)
    arr, tags = parse_tiff(raw)
    assert len(tags[273]) > 1
    np.testing.assert_array_equal(arr[..., 0], _quant(gray, 65535))
    img = Image.open(io.BytesIO(raw))
    assert img.size == (w, h) and img.mode.startswith("I;16")


def test_16bit_export_keeps_precision_through_effects(app):
    """RGBA16F effect buffers hold ~11 bits; 16-bit export must not."""
    n = 4096
    ramp = np.tile(np.linspace(0, 1, n, dtype=np.float32), (4, 1))
    app.load_float(ramp)
    out = app.js("""
        const e = await R.createExport(0, true, true);
        return {data: __b64enc(e.pixels), w: e.w, h: e.h};
    """)
    px = np.frombuffer(base64.b64decode(out["data"]), np.float32)
    levels = np.unique(np.round(px.reshape(out["h"], out["w"], 4)[..., 0] * 65535))
    assert len(levels) > 3500

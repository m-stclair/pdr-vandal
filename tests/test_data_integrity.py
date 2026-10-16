"""
P0: data integrity through the pipeline. What reaches the effects, what is
exported, and what the pixel readout reports must be the data itself.
"""
import re

import numpy as np
import pytest

from reference.fixtures import correlated_dn, pdr_normalize
from util import assert_close, assert_equal


def test_float_rgb_export_is_bit_exact(app):
    """Identity stack: a full-image export returns the ingested float32
    values exactly, NaNs included, with row 0 at the image top."""
    values, scale, offset = pdr_normalize(correlated_dn(60, 90))
    app.load_float(values, scale, offset)
    out = app.export()
    assert out.shape == (60, 90, 4)
    assert_equal(out[..., :3], values, "exported RGB")


def test_float_single_band_export_is_bit_exact(app):
    values = np.random.default_rng(1).random((45, 70)).astype(np.float32)
    app.load_float(values)
    out = app.export()
    for c in range(3):
        assert_equal(out[..., c], values, f"exported single band (channel {c})")


def _index_coded(h, w):
    """Single band whose value encodes its own index:
    v = (y*w + x + 0.5)/(w*h). Only valid where the image is drawn
    unfiltered (e.g. Debayer SUBSAMPLE, which fetches texels directly)."""
    return ((np.arange(h * w).reshape(h, w) + 0.5) / (h * w)).astype(np.float32)


def _decode(v, h, w):
    k = int(np.floor(float(v) * h * w))
    return k % w, k // w


def _xy_coded(h, w):
    """RGB whose R and G encode x and y separately: R = (x+0.5)/w,
    G = (y+0.5)/h. Linear filtering near a texel center moves each by a
    small fraction of a pixel, so the drawn pixel decodes unambiguously."""
    y, x = np.mgrid[0:h, 0:w]
    return np.dstack([(x + 0.5) / w, (y + 0.5) / h, np.full((h, w), 0.5)]).astype(np.float32)


def _parse_readout(text):
    m = re.match(r"^\((\d+), (\d+)\) of (\d+)×(\d+) -- (.+)$", text)
    assert m, f"unparseable readout: {text!r}"
    x, y, w, h = map(int, m.groups()[:4])
    return x, y, w, h, [float(v) for v in m.group(5).split(", ")]


def _rendered_at(app, client_x, client_y):
    """RGB of the rendered view under a client point."""
    return app.js("""
        const cv = R.gl.canvas, rect = cv.getBoundingClientRect();
        const px = (arg[0] - rect.left) * cv.width / rect.width;
        const py = (arg[1] - rect.top) * cv.height / rect.height;
        const vr = R.getViewRect();
        const tex = R.applyEffects(0);
        const pix = R.readFramebufferToPixels(tex, vr.w, vr.h);
        const o = (Math.floor(py - vr.y) * vr.w + Math.floor(px - vr.x)) * 4;
        return [pix[o], pix[o + 1], pix[o + 2]];
    """, [client_x, client_y])


def _client_at_pixel_center(app, x, y):
    """Integer client point over the center of image pixel (x, y)."""
    return app.js("""
        const [W, H] = R.getImageSize();
        const vr = R.getViewRect();
        const [sx, sy] = R.getViewSpan(vr.w, vr.h);
        const u = ((arg[0] + 0.5) / W - R.centerX) / sx + 0.5;
        const v = ((arg[1] + 0.5) / H - R.centerY) / sy + 0.5;
        const cv = R.gl.canvas, rect = cv.getBoundingClientRect();
        return [Math.round(rect.left + (vr.x + u * vr.w) * rect.width / cv.width),
                Math.round(rect.top + (vr.y + v * vr.h) * rect.height / cv.height)];
    """, [x, y])


@pytest.mark.parametrize("zoom, center", [(1.0, (0.5, 0.5)), (4.0, (0.3, 0.7))])
def test_readout_reports_the_pixel_on_screen_and_its_value(app, zoom, center):
    """The readout's coordinates name the pixel actually drawn under the
    cursor (decoded from the rendered image, not from the readout formula),
    and its values are that pixel's data in original units."""
    h, w = 48, 64
    values = _xy_coded(h, w)
    scale, offset = 3711.5, 212.25
    app.load_float(values, scale, offset)
    app.set_view(zoom, center)
    visible = app.js("""
        const [W, H] = R.getImageSize(), r = R.getViewRegion();
        return [Math.ceil(r.u0 * W), Math.floor(r.u1 * W) - 1,
                Math.ceil(r.v0 * H), Math.floor(r.v1 * H) - 1];
    """)
    xs = np.linspace(visible[0], visible[1], 3).astype(int)
    ys = np.linspace(visible[2], visible[3], 3).astype(int)
    for px in xs:
        for py in ys:
            cx, cy = _client_at_pixel_center(app, int(px), int(py))
            x, y, img_w, img_h, readout_values = _parse_readout(app.readout(cx, cy))
            assert (img_w, img_h) == (w, h)
            r, g, _ = _rendered_at(app, cx, cy)
            drawn = (int(np.floor(r * w)), int(np.floor(g * h)))
            assert (x, y) == drawn, \
                f"readout names ({x}, {y}) but pixel {drawn} is drawn under the cursor"
            expected = values[y, x].astype(np.float64) * scale + offset
            assert_close(readout_values, expected, 5e-4 * np.abs(expected).max(),
                         f"readout values at ({x}, {y})")


@pytest.mark.parametrize("scale, offset", [
    (0.3, 0.001),        # calibrated reflectance (I/F) range
    (250.0, -120.0),     # negative values (e.g. temperatures)
    (4000.0, 200.0),     # DN
    (3e-6, 1e-6),        # tiny radiances
])
def test_readout_value_precision(app, scale, offset):
    """The value readout must carry at least 4 significant digits, whatever
    the magnitude or sign of the data."""
    values = np.linspace(0.05, 0.95, 16 * 16, dtype=np.float32).reshape(16, 16)
    app.load_float(values, scale, offset)
    for fx, fy in [(0.2, 0.3), (0.6, 0.6), (0.9, 0.15)]:
        cx, cy = app.client_point(fx, fy)
        text = app.readout(cx, cy)
        x, y, _, _, (value,) = _parse_readout(text)
        expected = float(values[y, x]) * scale + offset
        assert value == pytest.approx(expected, rel=5e-4), \
            f"readout {text!r}: {value} vs data value {expected:.6g} (< 4 significant digits)"


def test_readout_subsample_maps_to_source_pixel(app):
    """With Debayer SUBSAMPLE the image is half size; the readout must name
    the half-size pixel and report the raw value of its CFA source site."""
    h, w = 48, 64
    values = _index_coded(h, w)
    app.load_float(values)
    # RGGB, SUBSAMPLE, BLUE plane: source site (2y + 1, 2x + 1).
    app.add_effect("Debayer", PATTERN=0, METHOD=2, PLANE=1)
    for fx, fy in [(0.2, 0.3), (0.7, 0.8)]:
        cx, cy = app.client_point(fx, fy)
        x, y, img_w, img_h, (value,) = _parse_readout(app.readout(cx, cy))
        assert (img_w, img_h) == (w // 2, h // 2)
        assert _decode(_rendered_at(app, cx, cy)[0], h, w) == (2 * x + 1, 2 * y + 1), \
            "drawn pixel is not the blue site of the reported half-size pixel"
        assert value == pytest.approx(float(values[2 * y + 1, 2 * x + 1]), rel=5e-4)


def test_input_stretch_absolute_clip_in_data_units(app):
    """ABSOLUTE clip bounds are in original data units: the effect chain
    receives (clip(raw, absMin, absMax) - absMin) / (absMax - absMin)."""
    raw = correlated_dn(50, 70)
    values, scale, offset = pdr_normalize(raw)
    app.load_float(values, scale, offset)
    abs_min, abs_max = 1500.0, 3000.0
    app.input_stretch(clipMode=3, stretchMode=0, absMin=abs_min, absMax=abs_max)
    out = app.export()[..., :3]
    # Reference from the float32 values the app holds, in original units.
    data = values.astype(np.float64) * scale + offset
    expected = (np.clip(data, abs_min, abs_max) - abs_min) / (abs_max - abs_min)
    assert_close(out, expected, 2e-6, "ABSOLUTE-clipped input")

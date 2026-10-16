"""
P1: neighborhood effects (2D Kernel, Unsharp Mask, Differential Shader)
work in image pixels. A full-image export applies the kernel at native
resolution; the zoomed preview must show the same spatial scale.
"""
import numpy as np
import pytest

from util import assert_close

# Effect outputs are stored as half floats (RGBA16F): ~2.4e-4 at 0.5-1.
HALF = 1e-3


def _only_input_stretch(app):
    app.js("S.filterEffectStack(f => f.name === 'Input Stretch');")


def _view_texture(app):
    """The rendered view (effect output) as float (h, w, 3), row 0 = top,
    plus the source uv of each pixel center."""
    out = app.js("""
        const vr = R.getViewRect();
        const [sx, sy] = R.getViewSpan(vr.w, vr.h);
        const view = R.readViewPixels(R.applyEffects(0));
        return {px: __b64enc(view.pixels),
                w: vr.w, h: vr.h, span: [sx, sy], center: [R.centerX, R.centerY]};
    """)
    import base64
    pix = np.frombuffer(base64.b64decode(out["px"]), dtype=np.float32).reshape(out["h"], out["w"], 4)
    u = out["center"][0] + ((np.arange(out["w"]) + 0.5) / out["w"] - 0.5) * out["span"][0]
    v = out["center"][1] + ((np.arange(out["h"]) + 0.5) / out["h"] - 0.5) * out["span"][1]
    return pix[..., :3].astype(np.float64), u, v


def _bilinear(img, u, v):
    """Sample an (H, W, C) image at source uv (pixel centers at (k+0.5)/N),
    edge-clamped, on the grid u (columns) x v (rows)."""
    h, w = img.shape[:2]
    x = np.clip(u * w - 0.5, 0, w - 1)
    y = np.clip(v * h - 0.5, 0, h - 1)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    x1, y1 = np.minimum(x0 + 1, w - 1), np.minimum(y0 + 1, h - 1)
    fx, fy = (x - x0)[None, :, None], (y - y0)[:, None, None]
    top = img[y0][:, x0] * (1 - fx) + img[y0][:, x1] * fx
    bottom = img[y1][:, x0] * (1 - fx) + img[y1][:, x1] * fx
    return top * (1 - fy) + bottom * fy


def _smooth_image(h, w):
    y, x = np.mgrid[0:h, 0:w]
    return np.dstack([
        0.5 + 0.3 * np.sin(x / 6.0) * np.cos(y / 9.0),
        0.5 + 0.3 * np.cos(x / 11.0 + y / 7.0),
        0.4 + 0.2 * np.sin((x + y) / 5.0),
    ]).astype(np.float32)


def test_2d_kernel_export_is_the_convolution(app):
    """Full-image export = convolution of the image with the effect's own
    kernel weights at one-image-pixel spacing (edge-clamped)."""
    img = np.random.default_rng(5).random((48, 64, 3)).astype(np.float32)
    app.load_float(img)
    _only_input_stretch(app)
    fx = app.add_effect("2D Kernel", kernelName="gaussian", kernelRadiusX=3, kernelRadiusY=2)
    out = app.export()[..., :3]
    k = app.js("""
        const info = S.getEffectById(arg).auxiliaryCache.kernelInfo;
        return {kernel: Array.from(info.kernel), w: info.width, h: info.height};
    """, fx)
    weights = np.array(k["kernel"]).reshape(k["h"], k["w"])
    hw, hh = k["w"] // 2, k["h"] // 2
    padded = np.pad(img.astype(np.float64), ((hh, hh), (hw, hw), (0, 0)), mode="edge")
    expected = sum(weights[j, i] * padded[j:j + 48, i:i + 64]
                   for j in range(k["h"]) for i in range(k["w"]))
    assert_close(out, expected, HALF, "2D Kernel export vs convolution")


@pytest.mark.parametrize("effect, config", [
    ("2D Kernel", {"kernelName": "gaussian", "kernelRadiusX": 4, "kernelRadiusY": 4}),
    ("Unsharp Mask", {}),
])
def test_zoomed_preview_matches_export(app, effect, config):
    """At zoom 4 the preview equals the full-image export resampled to the
    view: the kernel acts on image pixels, not display pixels."""
    app.load_float(_smooth_image(120, 160))
    _only_input_stretch(app)
    app.add_effect(effect, **config)
    export = app.export()[..., :3].astype(np.float64)
    app.set_view(4.0, (0.45, 0.55))
    view, u, v = _view_texture(app)
    expected = _bilinear(export, u, v)
    inner = (slice(8, -8), slice(8, -8))
    assert_close(view[inner], expected[inner], 1e-2, f"{effect} preview vs export at zoom 4")


def test_blur_width_is_zoom_invariant(app):
    """A Gaussian blur of a single bright pixel has the same width, in image
    pixels, at every zoom."""
    img = np.zeros((101, 101), dtype=np.float32)
    img[50, 50] = 1.0
    app.load_float(img)
    _only_input_stretch(app)
    app.add_effect("2D Kernel", kernelName="gaussian", kernelRadiusX=6, kernelRadiusY=6)
    export = app.export()[..., 0].astype(np.float64)
    xs = np.arange(101) + 0.5
    profile = export[50]
    ref_sigma = np.sqrt((profile * (xs - 50.5) ** 2).sum() / profile.sum())
    for zoom in (2.0, 4.0, 8.0):
        app.set_view(zoom, (50.5 / 101, 50.5 / 101))
        view, u, v = _view_texture(app)
        row = view[np.argmin(np.abs(v - 50.5 / 101)), :, 0]
        x_img = u * 101            # view columns in image-pixel coordinates
        sigma = np.sqrt((row * (x_img - 50.5) ** 2).sum() / row.sum())
        assert sigma == pytest.approx(ref_sigma, rel=0.1), \
            f"blur width {sigma:.2f} image px at zoom {zoom} vs {ref_sigma:.2f} in export"


def test_differential_shader_slope_is_zoom_invariant(app):
    """Slope of a linear ramp, in change per image pixel, is the same zoomed
    out (image pixels smaller than display pixels), zoomed in, and in the
    full-image export."""
    w = 2048
    ramp = np.tile((0.05 + 0.45 * np.arange(w) / w).astype(np.float32), (256, 1))
    app.load_float(ramp)
    _only_input_stretch(app)
    app.add_effect("Differential Shader", rawAmount=0.0, slopeAmount=1.0,
                   hillAmount=0.0, slamAmount=0.0, outScale=1.0, METRIC_ORD=2)
    expected = 4.0 * 0.45 / w                       # SLOPESCALE * slope
    export = app.export()[..., 0]
    assert_close(export[10:-10, 10:-10], np.full((236, w - 20), expected), 2e-3 * expected + 1e-7,
                 "slope in export")
    for zoom, center in [(1.0, (0.5, 0.5)), (2.0, (0.4, 0.5)), (6.0, (0.6, 0.5))]:
        app.set_view(zoom, center)
        view, _, _ = _view_texture(app)
        inner = view[4:-4, 4:-4, 0]
        assert inner.mean() == pytest.approx(expected, rel=0.02), \
            f"slope at zoom {zoom}: {inner.mean():.3e} vs {expected:.3e} (per image pixel)"

"""
Histogram panel: counts must match the displayed values (clamped to [0, 1],
8-bit levels), with out-of-range and NaN fractions reported, for the view or
the whole image. Anchored on numpy histograms of the known input.
"""
import numpy as np
import pytest

HIST = """
    const P = (await import('/glitch.js')).histogramPanel;
    if (arg) P.region = arg;
    P.update();
    const h = P.hist;
    return h && {gray: h.gray, counts: h.counts.map(c => Array.from(c)),
                 total: h.total, below: h.below, above: h.above, nan: h.nan};
"""

# Count calls to the renderer's samplers (a spy), returned by `calls()`.
SPY = """
    window.__calls = {view: 0, whole: 0};
    const sv = R.sampleView.bind(R), sw = R.sampleWholeImage.bind(R);
    R.sampleView = (...a) => { window.__calls.view++; return sv(...a); };
    R.sampleWholeImage = (...a) => { window.__calls.whole++; return sw(...a); };
"""


def _hist(app, region=None):
    return app.js(HIST, region)


def _calls(app):
    return app.js("return window.__calls;")


def _levels(values):
    """Displayed 8-bit level of each value (JS Math.round: half up)."""
    return np.floor(np.clip(values, 0, 1) * 255 + 0.5).astype(int)


def test_counts_match_displayed_values(app):
    """Identity stack (Input Stretch off), small image at fit: the view
    sample covers every image pixel equally, so bins are exact multiples of
    a numpy histogram of the clamped, quantized values."""
    rng = np.random.default_rng(3)
    h, w = 48, 64
    img = rng.uniform(-0.2, 1.2, (h, w, 3)).astype(np.float32)
    img[rng.random((h, w)) < 0.03, 1] = np.nan
    app.load_float(img)
    app.js("S.inputStretchEffect.disabled = true; S.requestRender(); await frames();")
    sw, sh = app.js("""
        const {w, h} = R.getViewRect(), k = Math.min(1, 256 / Math.max(w, h));
        return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
    """)
    # Point samples: sample (i, j) shows image pixel floor((i + 0.5) / sw * w).
    xs = np.floor((np.arange(sw) + 0.5) / sw * w).astype(int)
    ys = np.floor((np.arange(sh) + 0.5) / sh * h).astype(int)
    sample = img[ys][:, xs].reshape(-1, 3).astype(np.float64)
    valid = ~np.isnan(sample).any(axis=1)
    hist = _hist(app, "view")
    assert hist["gray"] is False
    assert hist["total"] == valid.sum()
    for c in range(3):
        expected = np.bincount(_levels(sample[valid, c]), minlength=256)
        assert np.array_equal(hist["counts"][c], expected), f"channel {c} bins differ"
    v = sample[valid]
    assert hist["below"] == pytest.approx((v < 0).any(axis=1).mean())
    assert hist["above"] == pytest.approx((v > 1).any(axis=1).mean())
    assert hist["nan"] == pytest.approx((~valid).mean())


def test_grayscale_and_color_detection(app):
    rng = np.random.default_rng(4)
    app.load_float(rng.random((40, 60)).astype(np.float32))
    single = _hist(app, "view")
    assert single["gray"] is True and len(single["counts"]) == 1
    app.add_effect("Colormap")
    assert _hist(app)["gray"] is False, "a colormapped single band is displayed in color"
    app.js("S.filterEffectStack(f => f.name === 'Input Stretch');")
    app.load_float(rng.random((40, 60, 3)).astype(np.float32))
    color = _hist(app)
    assert color["gray"] is False and len(color["counts"]) == 3


def test_region_toggle_view_vs_whole_image(app):
    """Zoomed into the dark half, the view histogram shows only dark values;
    the whole-image histogram equals the fit view's and is cached across
    pans (no re-render)."""
    img = np.full((120, 160), 0.2, dtype=np.float32)
    img[:, 80:] = 0.8
    app.load_float(img)
    fit = _hist(app, "view")
    assert fit["counts"][0][51] > 0 and fit["counts"][0][204] > 0
    app.js(SPY)
    assert _hist(app, "image") == fit, "whole image at fit should be the view histogram"
    assert _calls(app)["whole"] == 0, "at fit the view sample must be reused"
    app.set_view(4.0, (0.2, 0.5))
    view = _hist(app, "view")
    assert view["counts"][0][204] == 0 and view["counts"][0][51] == view["total"]
    whole = _hist(app, "image")
    assert whole["counts"] == fit["counts"], "whole-image histogram must equal the fit view's"
    assert _calls(app)["whole"] == 1
    app.set_view(4.0, (0.3, 0.6))      # pan: same stack and image
    assert _hist(app, "image")["counts"] == fit["counts"]
    assert _calls(app)["whole"] == 1, "panning must not recompute the whole-image histogram"


def test_whole_image_sampling_does_not_disturb_view_state(app):
    """The offscreen whole-image render must not recompute view-tracking
    state such as Debayer AUTO gains on the current view."""
    h, w = 120, 160
    y, x = np.mgrid[0:h, 0:w]
    rgb = np.dstack([0.2 + 0.7 * x / w, 0.3 + 0.5 * y / h, 0.8 - 0.6 * x / w])
    cls = np.array([[0, 1], [1, 2]])[y % 2, x % 2]
    app.load_float(np.take_along_axis(rgb, cls[..., None], 2)[..., 0].astype(np.float32))
    app.set_view(4.0, (0.2, 0.25))
    fx = app.add_effect("Debayer", RGB=True, AUTO=True, AUTO_REGION=1)
    gains = app.js("const c = S.getEffectById(arg).config; return [c.GAIN_R, c.GAIN_G, c.GAIN_B, c.AUTO];", fx)
    _hist(app, "image")
    app.js("S.requestRender(); await frames(4);")
    after = app.js("const c = S.getEffectById(arg).config; return [c.GAIN_R, c.GAIN_G, c.GAIN_B, c.AUTO];", fx)
    assert after == gains
    assert app.js("return [R.zoom, R.centerX, R.centerY];") == pytest.approx([4.0, 0.2, 0.25], abs=0.05)


def test_no_sampling_while_collapsed(app):
    app.load_float(np.random.default_rng(5).random((40, 60)).astype(np.float32))
    app.js(SPY + "document.getElementById('histogramPanel').open = false;")
    app.js("for (let i = 0; i < 5; i++) { S.requestRender(); await frames(2); } await new Promise(r => setTimeout(r, 400));")
    assert _calls(app) == {"view": 0, "whole": 0}
    app.js("document.getElementById('histogramPanel').open = true; await new Promise(r => setTimeout(r, 400));")
    assert _calls(app)["view"] >= 1, "opening the panel should update it"


def test_ui_toggles_and_automatic_updates(app):
    """Real clicks: the toggles switch region / scale without folding the
    panel, and the histogram updates by itself after rendering."""
    app.load_float(np.random.default_rng(6).random((40, 60, 3)).astype(np.float32))
    app.page.wait_for_timeout(400)
    assert _hist_state(app)["hasHist"], "histogram should update after rendering, unprompted"
    app.page.locator("#histRegion button[data-region=image]").click()
    app.page.locator("#histScale button[data-scale=lin]").click()
    state = _hist_state(app)
    assert state["open"] and state["region"] == "image" and state["log"] is False


def _hist_state(app):
    return app.js("""
        const P = (await import('/glitch.js')).histogramPanel;
        return {hasHist: P.hist !== null, open: P.panel.open, region: P.region, log: P.logScale};
    """)

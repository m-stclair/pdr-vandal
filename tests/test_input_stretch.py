"""
Input Stretch's ArcSinh curve and adjustable percentile clip, checked
against numpy: np.arcsinh for the curve, np.percentile for the bounds.
"""
import numpy as np
import pytest

from util import assert_close

# One bin of the percentile histogram (utils/stretch.js PERCENTILE_BINS).
PCT_BIN = 1 / 65536


def _enums(app):
    return app.js("""
        const m = await import('/effects/inputstretch.js');
        return {clip: m.ClipEnum, stretch: m.StretchEnum};
    """)


def _bounds(app):
    """[min, max] Input Stretch is using now, in normalized source units."""
    return app.js("""
        const m = await import('/effects/inputstretch.js');
        return m.inputStretchBounds(S.inputStretchEffect);
    """)


def test_existing_enum_values_unchanged(app):
    """Presets and saved stacks store these numbers: new modes are
    appended, never inserted."""
    enums = _enums(app)
    assert {k: enums["clip"][k] for k in ("NONE", "STDEV", "P02_P98", "ABSOLUTE", "ZSCALE")} == \
        {"NONE": 0, "STDEV": 1, "P02_P98": 2, "ABSOLUTE": 3, "ZSCALE": 4}
    assert {k: enums["stretch"][k] for k in ("LIN", "LOGLIKE", "TANH")} == \
        {"LIN": 0, "LOGLIKE": 1, "TANH": 2}


@pytest.mark.parametrize("k", [0.1, 10.0, 500.0])
def test_asinh_matches_numpy(app, k):
    """asinh(k x) / asinh(k) on the clipped, normalized input; NaN passes."""
    enums = _enums(app)
    values = np.linspace(0, 1, 40 * 50, dtype=np.float32).reshape(40, 50)
    values[3, 7] = np.nan
    app.load_float(values)
    app.input_stretch(clipMode=enums["clip"]["NONE"], stretchMode=enums["stretch"]["ASINH"],
                      asinhParam=k)
    out = app.export()[..., 0]
    x = values.astype(np.float64)
    expected = np.arcsinh(k * x) / np.arcsinh(k)
    # float32 GPU arithmetic over a curve with slope up to k / asinh(k)
    assert_close(out, expected, 2e-6 * max(1.0, k / np.arcsinh(k)), f"asinh k={k}")


def test_asinh_endpoints_and_monotonic(app):
    enums = _enums(app)
    values = np.linspace(0, 1, 64, dtype=np.float32).reshape(8, 8)
    app.load_float(values)
    app.input_stretch(clipMode=enums["clip"]["NONE"], stretchMode=enums["stretch"]["ASINH"],
                      asinhParam=1000.0)
    out = app.export()[..., 0].ravel()
    assert abs(out[0]) < 1e-6 and abs(out[-1] - 1) < 1e-5
    assert np.all(np.diff(out) > 0)


def _sparse_tail_data():
    """Skewed data with NaNs, so the far tail is sparse: neighboring order
    statistics there are many histogram bins apart."""
    rng = np.random.default_rng(11)
    values = np.clip(rng.gamma(2.0, 0.05, size=(300, 400)), 0, 1).astype(np.float32)
    values[::7, ::13] = np.nan
    return values


@pytest.mark.parametrize("low, high", [(0.5, 99.5), (2, 98), (0.001, 99.999), (0, 100)])
def test_percentile_bounds_match_numpy(app, low, high):
    enums = _enums(app)
    values = _sparse_tail_data()
    app.load_float(values)
    app.input_stretch(clipMode=enums["clip"]["PERCENTILE"], pctLow=low, pctHigh=high)
    finite = values[np.isfinite(values)].astype(np.float64)
    assert_close(_bounds(app), np.percentile(finite, [low, high]), PCT_BIN,
                 f"percentile bounds {low}-{high}")


def test_percentile_bounds_pool_rgb_channels(app):
    """Like pdrview's p02 / p98, percentiles are over all channels' values."""
    enums = _enums(app)
    rng = np.random.default_rng(5)
    values = np.dstack([rng.random((50, 60)) * s for s in (0.3, 0.6, 1.0)]).astype(np.float32)
    app.load_float(values)
    app.input_stretch(clipMode=enums["clip"]["PERCENTILE"], pctLow=1, pctHigh=99)
    assert_close(_bounds(app), np.percentile(values.astype(np.float64), [1, 99]), PCT_BIN,
                 "pooled RGB percentiles")


def test_percentile_clip_renders_with_its_bounds(app):
    """The rendered image is the linear clip to the reported bounds, and
    swapped low / high percentiles mean the same clip."""
    enums = _enums(app)
    values = _sparse_tail_data()
    app.load_float(values)
    app.input_stretch(clipMode=enums["clip"]["PERCENTILE"], stretchMode=enums["stretch"]["LIN"],
                      pctLow=99.9, pctHigh=0.1)
    lo, hi = _bounds(app)
    assert lo < hi
    out = app.export()[..., 0]
    expected = np.clip((values.astype(np.float64) - lo) / (hi - lo), 0, 1)
    assert_close(out, expected, 2e-6, "percentile-clipped render")


def test_percentile_bounds_follow_a_new_source(app):
    """The cached histogram belongs to one source; loading another must not
    reuse it."""
    enums = _enums(app)
    app.load_float(np.linspace(0, 0.5, 2000, dtype=np.float32).reshape(40, 50))
    app.input_stretch(clipMode=enums["clip"]["PERCENTILE"], pctLow=0, pctHigh=100)
    first = _bounds(app)
    app.load_float(np.linspace(0.5, 1, 2000, dtype=np.float32).reshape(40, 50))
    assert_close(first, [0, 0.5], PCT_BIN, "first source")
    assert_close(_bounds(app), [0.5, 1], PCT_BIN, "second source")


def test_percentile_on_8bit_image(app):
    """Browser images: percentiles of the RGB bytes / 255, alpha ignored."""
    enums = _enums(app)
    rng = np.random.default_rng(2)
    rgba = rng.integers(0, 256, size=(30, 40, 4), dtype=np.uint8)
    rgba[..., 3] = 255
    held = app.load_rgba8(rgba)
    app.input_stretch(clipMode=enums["clip"]["PERCENTILE"], pctLow=5, pctHigh=95)
    rgb = held[..., :3].astype(np.float64) / 255
    assert_close(_bounds(app), np.percentile(rgb, [5, 95]), PCT_BIN, "8-bit percentiles")

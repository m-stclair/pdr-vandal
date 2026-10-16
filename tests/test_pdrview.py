"""
P0: pdrview.py normalization, the step every PDR product goes through
before the app sees it. Expected values are computed independently here.
"""
import importlib.util
import sys
import types
from pathlib import Path

import numpy as np
import pytest

from util import assert_close, assert_equal

REPO = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def pdrview():
    # pdrview runs under Pyodide; stub the one Pyodide import it needs.
    if "pyodide.ffi" not in sys.modules:
        pyodide = types.ModuleType("pyodide")
        ffi = types.ModuleType("pyodide.ffi")
        ffi.to_js = lambda obj, **kwargs: obj
        pyodide.ffi = ffi
        sys.modules["pyodide"] = pyodide
        sys.modules["pyodide.ffi"] = ffi
    spec = importlib.util.spec_from_file_location("pdrview", REPO / "pdrview.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _objects(pdrview, bands, h, w):
    entry = pdrview.RegistryEntry(data=types.SimpleNamespace(filename="test.img"), objects={})
    obj = pdrview.ArrayObject(
        band_pixels={}, info=pdrview.ArrayInfo(width=w, height=h, bands=bands, json_meta="{}"),
        name="IMAGE",
    )
    return entry, obj, pdrview.PixelCache(max_bytes=1 << 30)


def _rgb_cube():
    """(3, H, W) masked cube: correlated DN values, a NaN (masked as
    invalid, as prep_masked_array does), and a masked missing-data sentinel
    far outside the valid range, as pdr returns for special constants."""
    rng = np.random.default_rng(7)
    base = 1500 + 400 * rng.random((20, 30))
    cube = np.stack([base + 50, 0.8 * base, 1.2 * base - 300]).astype(np.float64)
    cube[1, 3, 4] = np.nan
    cube[2, 10, 11] = -9999.0
    masked = np.ma.masked_invalid(cube)
    masked[2, 10, 11] = np.ma.masked
    return masked


def test_rgb_uses_one_scale_and_offset_over_valid_pixels(pdrview):
    cube = _rgb_cube()
    entry, obj, cache = _objects(pdrview, 3, 20, 30)
    stats = pdrview._compute_stats(cube)
    bp, scaled = pdrview._scale_and_cache(entry, obj, "RGB", cube, stats, cache)

    valid = cube.compressed()
    offset = valid.min()
    scale = valid.max() - offset
    assert bp.channels == 3
    assert bp.offset == pytest.approx(offset, rel=0, abs=0), "offset must be the min over valid pixels of all bands"
    assert bp.scale == pytest.approx(scale, rel=1e-15), "scale must span the valid range of all bands"

    # Expected: (raw - offset) / scale in float32, masked -> NaN, BIP order.
    expected = ((cube.data - offset) / scale).astype(np.float32)
    expected[cube.mask] = np.nan
    expected_bip = np.moveaxis(expected, 0, -1).ravel()
    assert_equal(scaled, expected_bip, "normalized RGB (BIP)")


def test_single_band_row_major(pdrview):
    band = _rgb_cube()[0]
    entry, obj, cache = _objects(pdrview, 1, 20, 30)
    bp, scaled = pdrview._scale_and_cache(entry, obj, 0, band, pdrview._compute_stats(band), cache)
    valid = band.compressed()
    expected = ((band.data - valid.min()) / (valid.max() - valid.min())).astype(np.float32)
    expected[np.ma.getmaskarray(band)] = np.nan
    assert bp.channels == 1
    assert_equal(scaled, expected.ravel(), "normalized single band")


def test_stats_are_over_valid_pixels_in_normalized_units(pdrview):
    cube = _rgb_cube()
    entry, obj, cache = _objects(pdrview, 3, 20, 30)
    bp, _ = pdrview._scale_and_cache(entry, obj, "RGB", cube, pdrview._compute_stats(cube), cache)
    valid = cube.compressed()
    offset, scale = valid.min(), valid.max() - valid.min()
    p02, p98 = np.percentile(valid, [2, 98])
    assert_close(
        [bp.mean, bp.std, bp.p02, bp.p98],
        [(valid.mean() - offset) / scale, valid.std() / scale,
         (p02 - offset) / scale, (p98 - offset) / scale],
        1e-12, "normalized statistics",
    )


def test_compute_stats_ignores_nonfinite_and_masked(pdrview):
    data = np.ma.masked_array([1.0, 2.0, 3.0, np.nan, np.inf, 1e9], mask=[0, 0, 0, 0, 0, 1])
    stats = pdrview._compute_stats(data)
    assert stats["mean"] == pytest.approx(2.0)
    assert stats["std"] == pytest.approx(np.std([1.0, 2.0, 3.0]))


def test_rescale_after_cache_eviction_is_identical(pdrview):
    cube = _rgb_cube()
    entry, obj, cache = _objects(pdrview, 3, 20, 30)
    bp, first = pdrview._scale_and_cache(entry, obj, "RGB", cube, pdrview._compute_stats(cube), cache)
    _, again = pdrview._rescale_and_cache(entry, obj, "RGB", cube, bp, cache)
    assert_equal(again, first, "re-scaled pixels after eviction")


def test_bsq_to_bip_band_interleave(pdrview):
    bsq = np.arange(3 * 2 * 4, dtype=np.float64).reshape(3, 2, 4)
    bip = pdrview.bsq_to_bip_1d(bsq)
    assert bip.dtype == np.float32
    # Pixel (y, x) contributes bands 0, 1, 2 consecutively, row-major.
    for y in range(2):
        for x in range(4):
            i = (y * 4 + x) * 3
            assert list(bip[i:i + 3]) == [bsq[0, y, x], bsq[1, y, x], bsq[2, y, x]]

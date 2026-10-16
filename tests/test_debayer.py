"""
P0: Bayer demosaicking. Anchored on the published Malvar-He-Cutler
coefficients, on properties any correct demosaicker satisfies, and on an
independent numpy reference (reference/demosaic.py).
"""
import re
from pathlib import Path

import numpy as np
import pytest

from reference import demosaic as ref
from reference.fixtures import random_mosaic
from util import assert_close, assert_equal

REPO = Path(__file__).resolve().parent.parent
METHODS = {"bilinear": 0, "malvar": 1}
PLANES = {"RED": 0, "BLUE": 1, "GREEN1": 2, "GREEN2": 3}


def _shader_kernel(name):
    src = (REPO / "shaders" / "debayer.frag").read_text()
    m = re.search(rf"const float {name}\[25\] = float\[25\]\((.*?)\);", src, re.S)
    assert m, f"kernel {name} not found in debayer.frag"
    body = re.sub(r"//[^\n]*", "", m.group(1))
    return np.array([float(v) for v in body.replace("\n", " ").split(",")]).reshape(5, 5)


@pytest.mark.parametrize("name, published", [
    ("F1", ref.MHC_G_AT_R_OR_B),
    ("F2", ref.MHC_RB_AT_G_TARGET_IN_ROW),
    ("F3", ref.MHC_RB_AT_G_TARGET_IN_COL),
    ("F4", ref.MHC_RB_AT_BR),
])
def test_shader_kernels_match_published_coefficients(name, published):
    assert_equal(_shader_kernel(name), published, f"debayer.frag {name}")


def _mosaic_of(rgb, pattern):
    """Sample an (H, W, 3) image through a CFA."""
    h, w = rgb.shape[:2]
    cls = ref.cfa_classes(h, w, pattern)
    return np.take_along_axis(rgb, cls[..., None], axis=2)[..., 0].astype(np.float32)


def _debayer_rgb(app, mosaic, pattern, method):
    app.load_float(mosaic)
    app.configure(app.debayer_id, PATTERN=ref.PATTERN_INDEX[pattern],
                  METHOD=METHODS[method], RGB=True)
    return app.export()[..., :3].astype(np.float64)


@pytest.fixture
def debayer_app(app):
    app.load_float(random_mosaic(8, 8))
    app.debayer_id = app.add_effect(
        "Debayer", RGB=True, AUTO=False, GAIN_R=1.0, GAIN_G=1.0, GAIN_B=1.0)
    return app


@pytest.mark.parametrize("method", METHODS)
@pytest.mark.parametrize("pattern", ref.PATTERNS)
def test_reconstruction(debayer_app, pattern, method):
    app = debayer_app
    h, w = 64, 96

    # A constant image reconstructs exactly everywhere (borders included:
    # mirror reflection keeps neighbor classes right).
    constant = np.full((h, w), 0.37, dtype=np.float32)
    assert_close(_debayer_rgb(app, constant, pattern, method), np.full((h, w, 3), 0.37),
                 1e-6, f"{pattern}/{method} constant")

    # A gray linear ramp reconstructs exactly away from the 2-px border.
    y, x = np.mgrid[0:h, 0:w]
    ramp = (0.1 + 0.004 * x + 0.006 * y).astype(np.float32)
    out = _debayer_rgb(app, ramp, pattern, method)
    inner = (slice(2, -2), slice(2, -2))
    assert_close(out[inner], np.repeat(ramp[inner][..., None], 3, axis=2), 1e-6,
                 f"{pattern}/{method} linear ramp (interior)")

    # Random mosaic: agrees with the reference implementation everywhere.
    mosaic = random_mosaic(h, w)
    expected = np.clip(ref.demosaic(mosaic, pattern, method), 0.0, 1.0)
    assert_close(_debayer_rgb(app, mosaic, pattern, method), expected, 1e-6,
                 f"{pattern}/{method} vs reference")


@pytest.mark.parametrize("pattern", ref.PATTERNS)
def test_pattern_phase_recovers_known_colors(debayer_app, pattern):
    """A mosaic of flat color blocks, taken through `pattern`, debayers to
    the original colors in block interiors only when the same pattern is
    selected. Anchored on the source image, not on the implementation."""
    h, w = 48, 64
    colors = np.array([[0.8, 0.2, 0.1], [0.1, 0.7, 0.3], [0.2, 0.3, 0.9], [0.6, 0.6, 0.2]])
    image = np.empty((h, w, 3))
    for i, color in enumerate(colors):
        image[(i // 2) * 24:(i // 2 + 1) * 24, (i % 2) * 32:(i % 2 + 1) * 32] = color
    mosaic = _mosaic_of(image, pattern)
    interiors = [(slice(by * 24 + 4, by * 24 + 20), slice(bx * 32 + 4, bx * 32 + 28))
                 for by in (0, 1) for bx in (0, 1)]
    for method in METHODS:
        out = _debayer_rgb(debayer_app, mosaic, pattern, method)
        for block in interiors:
            assert_close(out[block], image[block], 1e-6, f"{pattern}/{method} block colors")
        wrong = next(p for p in ref.PATTERNS if p != pattern)
        out = _debayer_rgb(debayer_app, mosaic, wrong, method)
        worst = max(np.abs(out[b] - image[b]).max() for b in interiors)
        assert worst > 0.1, f"{wrong} on {pattern} data should not reproduce the colors"


@pytest.mark.parametrize("pattern", ref.PATTERNS)
def test_subsample_planes_are_exact_cfa_sites(app, pattern):
    mosaic = random_mosaic(64, 96)
    app.load_float(mosaic)
    fx = app.add_effect("Debayer", PATTERN=ref.PATTERN_INDEX[pattern], METHOD=2)
    for plane, index in PLANES.items():
        app.configure(fx, PLANE=index)
        out = app.export()
        assert out.shape[:2] == (32, 48), "SUBSAMPLE output must be half size"
        assert_equal(out[..., 0], ref.subsample_plane(mosaic, pattern, plane),
                     f"{pattern} SUBSAMPLE {plane}")


def test_single_channel_output_selects_that_channel(app):
    mosaic = random_mosaic(64, 96)
    app.load_float(mosaic)
    fx = app.add_effect("Debayer", PATTERN=0, METHOD=1, RGB=False)
    expected = np.clip(ref.demosaic(mosaic, "RGGB", "malvar"), 0.0, 1.0)
    for channel in range(3):
        app.configure(fx, CHANNEL=channel)
        out = app.export()
        assert_close(out[..., 0], expected[..., channel], 1e-6, f"single-channel output {channel}")

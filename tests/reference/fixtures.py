"""Seeded synthetic test data."""
import numpy as np


def correlated_dn(height=200, width=300, seed=11, nan_fraction=0.002):
    """
    Three strongly correlated DN-like bands (~200-4000) with spatial
    structure, small independent noise, per-band offsets and gradients, and
    a few NaNs in one band: shaped like real multispectral data, where DCS
    has small minor principal components to amplify.
    """
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:height, 0:width]
    base = 2000 + 600 * np.sin(x / 47) * np.cos(y / 31) + 150 * rng.standard_normal((height, width))
    raw = np.dstack([
        base + 8 * rng.standard_normal(base.shape) + 60 * x / width,
        0.9 * base + 300 + 8 * rng.standard_normal(base.shape),
        0.75 * base - 100 + 9 * rng.standard_normal(base.shape) + 50 * y / height,
    ])
    raw[..., 1][rng.random(base.shape) < nan_fraction] = np.nan
    return raw


def pdr_normalize(raw):
    """
    Normalize as pdrview._scale_and_cache does: one scalar offset and scale
    over all bands. Returns (float32 values in [0, 1], scale, offset).
    """
    offset = float(np.nanmin(raw))
    scale = float(np.nanmax(raw)) - offset
    return ((raw - offset) / scale).astype(np.float32), scale, offset


def correlated_rgba8(height=180, width=240, seed=5):
    """Correlated 8-bit RGB image (opaque RGBA), like a photo."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:height, 0:width]
    base = 120 + 60 * np.sin(x / 23) * np.cos(y / 17) + 15 * rng.standard_normal((height, width))
    rgb = np.dstack([
        base + 4 * rng.standard_normal(base.shape) + 10,
        0.9 * base + 3 * rng.standard_normal(base.shape) + 20,
        0.8 * base + 5 * rng.standard_normal(base.shape),
    ])
    rgba = np.empty((height, width, 4), dtype=np.uint8)
    rgba[..., :3] = np.clip(np.round(rgb), 0, 255)
    rgba[..., 3] = 255
    return rgba


def random_mosaic(height=64, width=96, seed=3):
    """Uniform random single-band mosaic in [0.05, 0.95]: every neighbor
    combination occurs, so any kernel or phase error shows up."""
    rng = np.random.default_rng(seed)
    return (0.05 + 0.9 * rng.random((height, width))).astype(np.float32)

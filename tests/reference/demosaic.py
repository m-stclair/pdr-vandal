"""
Reference Bayer demosaicking for tests: bilinear and Malvar-He-Cutler.

The Malvar-He-Cutler kernels below are typed in from the paper, not copied
from shaders/debayer.frag, so tests can catch a wrong coefficient in the
shader:

    H. S. Malvar, L. He, R. Cutler, "High-quality linear interpolation for
    demosaicing of Bayer-patterned color images", Proc. IEEE ICASSP 2004,
    vol. 3, pp. 485-488, Fig. 2 (coefficients scaled by 8).

The one convention taken from the app is border handling: neighbors past
the edge are mirror-reflected (numpy "reflect" padding: -1 -> 1), which
keeps every neighbor's CFA class correct.
"""
import numpy as np

R, G, B = 0, 1, 2

# CFA class at [y % 2][x % 2], in effects/debayer.js BayerPatternEnum order.
PATTERNS = {
    "RGGB": ((R, G), (G, B)),
    "BGGR": ((B, G), (G, R)),
    "GRBG": ((G, R), (B, G)),
    "GBRG": ((G, B), (R, G)),
}
PATTERN_INDEX = {name: i for i, name in enumerate(PATTERNS)}

# Malvar-He-Cutler 2004, Fig. 2, times 8.
MHC_G_AT_R_OR_B = np.array([
    [0, 0, -1, 0, 0],
    [0, 0, 2, 0, 0],
    [-1, 2, 4, 2, -1],
    [0, 0, 2, 0, 0],
    [0, 0, -1, 0, 0],
], dtype=float)
# R (or B) at a green site whose row contains R (or B): target is left/right.
MHC_RB_AT_G_TARGET_IN_ROW = np.array([
    [0, 0, 0.5, 0, 0],
    [0, -1, 0, -1, 0],
    [-1, 4, 5, 4, -1],
    [0, -1, 0, -1, 0],
    [0, 0, 0.5, 0, 0],
], dtype=float)
# R (or B) at a green site whose column contains R (or B): target is up/down.
MHC_RB_AT_G_TARGET_IN_COL = MHC_RB_AT_G_TARGET_IN_ROW.T.copy()
# R at a B site, or B at an R site.
MHC_RB_AT_BR = np.array([
    [0, 0, -1.5, 0, 0],
    [0, 2, 0, 2, 0],
    [-1.5, 0, 6, 0, -1.5],
    [0, 2, 0, 2, 0],
    [0, 0, -1.5, 0, 0],
], dtype=float)


def cfa_classes(height, width, pattern):
    """CFA class (R=0, G=1, B=2) of every pixel."""
    cell = np.array(PATTERNS[pattern])
    return cell[np.arange(height)[:, None] % 2, np.arange(width)[None, :] % 2]


def demosaic(mosaic, pattern, method):
    """
    Full-resolution RGB from a single-band mosaic.

    method: "bilinear" or "malvar". Returns float64 (H, W, 3), unclamped.
    """
    m = np.asarray(mosaic, dtype=np.float64)
    h, w = m.shape
    padded = np.pad(m, 2, mode="reflect")

    def at(dy, dx):
        return padded[2 + dy:2 + dy + h, 2 + dx:2 + dx + w]

    def kernel(k):
        return sum(k[i, j] * at(i - 2, j - 2)
                   for i in range(5) for j in range(5) if k[i, j]) / 8.0

    cls = cfa_classes(h, w, pattern)
    # Reflection preserves parity, so the left neighbor's class follows the
    # pattern even at x = 0.
    left_cls = np.array(PATTERNS[pattern])[
        np.arange(h)[:, None] % 2, (np.arange(w)[None, :] - 1) % 2
    ]
    if method == "bilinear":
        at_rb_for_g = 0.25 * (at(-1, 0) + at(1, 0) + at(0, -1) + at(0, 1))
        target_in_row = 0.5 * (at(0, -1) + at(0, 1))
        target_in_col = 0.5 * (at(-1, 0) + at(1, 0))
        diagonal = 0.25 * (at(-1, -1) + at(-1, 1) + at(1, -1) + at(1, 1))
    elif method == "malvar":
        at_rb_for_g = kernel(MHC_G_AT_R_OR_B)
        target_in_row = kernel(MHC_RB_AT_G_TARGET_IN_ROW)
        target_in_col = kernel(MHC_RB_AT_G_TARGET_IN_COL)
        diagonal = kernel(MHC_RB_AT_BR)
    else:
        raise ValueError(method)

    out = np.empty((h, w, 3))
    for target in (R, G, B):
        if target == G:
            estimate = at_rb_for_g
        else:
            estimate = np.where(
                cls == G,
                np.where(left_cls == target, target_in_row, target_in_col),
                diagonal,
            )
        out[..., target] = np.where(cls == target, m, estimate)
    return out


# Debayer PLANE enum order: RED, BLUE, GREEN1, GREEN2. GREEN1/GREEN2 are the
# first and second green sites of a 2x2 cell in raster order.
def subsample_plane(mosaic, pattern, plane):
    """The half-resolution plane of one CFA site, exactly as sampled."""
    target = {"RED": R, "BLUE": B, "GREEN1": G, "GREEN2": G}[plane]
    sites = [(y, x) for y in (0, 1) for x in (0, 1)
             if PATTERNS[pattern][y][x] == target]
    y, x = sites[1 if plane == "GREEN2" else 0]
    h, w = mosaic.shape
    return np.asarray(mosaic)[y:h - h % 2:2, x:w - w % 2:2]

"""
P0: Decorrelation Stretch against marslab's decorrelation_stretch (vendored
in reference/marslab_dcs.py), run on the same data in original data units.
"""
import base64

import numpy as np
import pytest

from reference.fixtures import correlated_dn, correlated_rgba8, pdr_normalize
from reference.marslab_dcs import decorrelation_stretch
from util import assert_close, assert_equal

# name -> (effect config, marslab kwargs)
MODES = {
    "joint_s1": ({"STRETCH": 0, "SIGMA_MODE": 0, "SIGMA": 1}, {"sigma": 1, "contrast_stretch": None}),
    "joint_s05": ({"STRETCH": 0, "SIGMA_MODE": 0, "SIGMA": 0.5}, {"sigma": 0.5, "contrast_stretch": None}),
    "joint_classic": ({"STRETCH": 0, "SIGMA_MODE": 1}, {"sigma": None, "contrast_stretch": None}),
    "perchan_0_0": ({"STRETCH": 1, "LOW": 0, "HIGH": 0}, {"sigma": 1, "contrast_stretch": (0, 0)}),
    "perchan_1_2": ({"STRETCH": 1, "LOW": 1, "HIGH": 2}, {"sigma": 1, "contrast_stretch": (1, 2)}),
}


@pytest.fixture(scope="module", autouse=True)
def _reference_numpy_is_compatible():
    # The vendored marslab code uses np.linalg.eig, which returns complex
    # arrays from numpy 2.5 on even for real symmetric input; the reference
    # would then be silently wrong (or fail on percentiles). See
    # tests/requirements.txt.
    if np.iscomplexobj(np.linalg.eig(np.eye(2))[0]):
        pytest.fail(f"numpy {np.__version__} returns complex eigenvalues; "
                    "the marslab reference needs numpy < 2.5")


def marslab(u, **kwargs):
    """marslab DCS of an (H, W, 3) array; non-finite pixels masked as the
    app treats them. Returns float64 with NaN where masked."""
    mask = ~np.isfinite(u).all(axis=-1)
    channels = [np.ma.masked_array(u[..., i], mask=mask) for i in range(3)]
    result = decorrelation_stretch(channels, **kwargs)
    return np.ma.filled(result.astype(np.float64), np.nan)


@pytest.fixture(scope="module")
def dn():
    return correlated_dn(120, 180)


def _dcs_export(app, config):
    app.add_effect("Decorrelation Stretch", REGION=0, **config)
    return app.export()[..., :3]


@pytest.mark.parametrize("mode", MODES)
def test_float_data_matches_marslab_in_data_units(app, dn, mode):
    values, scale, offset = pdr_normalize(dn)
    app.load_float(values, scale, offset)
    config, kwargs = MODES[mode]
    out = _dcs_export(app, config)
    data = values.astype(np.float64) * scale + offset   # original units
    assert_close(out, marslab(data, **kwargs), 2e-6, f"DCS {mode} vs marslab")


@pytest.mark.parametrize("mode", MODES)
def test_absolute_clipped_input_matches_marslab(app, dn, mode):
    """Statistics after Input Stretch: marslab on the clipped data."""
    values, scale, offset = pdr_normalize(dn)
    app.load_float(values, scale, offset)
    app.input_stretch(clipMode=3, stretchMode=0, absMin=1500.0, absMax=3000.0)
    config, kwargs = MODES[mode]
    out = _dcs_export(app, config)
    data = np.clip(values.astype(np.float64) * scale + offset, 1500.0, 3000.0)
    assert_close(out, marslab(data, **kwargs), 2e-6, f"DCS {mode} on clipped input")


@pytest.mark.parametrize("mode", MODES)
def test_nonlinear_stretch_input_matches_marslab(app, dn, mode):
    """LOGLIKE Input Stretch has no map back to data units, so DCS works on
    the stretched values; reference computed in float32 like the GPU."""
    values, scale, offset = pdr_normalize(dn)
    app.load_float(values, scale, offset)
    app.input_stretch(clipMode=0, stretchMode=1, stretchParam=2.0)
    config, kwargs = MODES[mode]
    out = _dcs_export(app, config)
    n = np.clip(values, np.float32(0), np.float32(1))
    stretched = (np.float32(3) * n) / (np.float32(1) + np.float32(2) * n)
    assert_close(out, marslab(stretched.astype(np.float64), **kwargs), 2e-5,
                 f"DCS {mode} on LOGLIKE input")


@pytest.mark.parametrize("mode", MODES)
def test_8bit_image_matches_marslab_on_uint8(app, mode):
    """Browser images: marslab sees the 0-255 values."""
    held = app.load_rgba8(correlated_rgba8())
    config, kwargs = MODES[mode]
    out = _dcs_export(app, config)
    assert_close(out, marslab(held[..., :3].astype(np.float64), **kwargs), 2e-6,
                 f"DCS {mode} on 8-bit image")


def test_single_band_is_untouched(app):
    values = np.random.default_rng(2).random((40, 50)).astype(np.float32)
    app.load_float(values)
    out = _dcs_export(app, MODES["joint_s1"][0])
    assert_equal(out[..., 0], values, "single band through DCS")


def test_gray_color_image_is_untouched(app):
    gray = np.random.default_rng(3).integers(0, 256, (30, 40), dtype=np.uint8)
    rgba = np.dstack([gray, gray, gray, np.full_like(gray, 255)])
    held = app.load_rgba8(rgba)
    out = _dcs_export(app, MODES["perchan_1_2"][0])
    assert_close(out, held[..., :3] / 255.0, 1e-7, "gray image through DCS")


# --- dcs_math.js, run in the page, against marslab ---------------------------

_DCS_MATH_FINAL = """
const M = await import('/utils/dcs_math.js');
const data = __b64dec(arg.data, Float64Array);
const n = data.length / 3;
const tr = M.dcsTransform(M.finalizeMoments(M.accumulateMoments(data, n, 3)), arg.sigma);
const out = M.applyTransform(data, n, tr, 3);
let lo, hi;
if (arg.stretch === null) {
    let a = Infinity, b = -Infinity;
    for (const v of out) if (Number.isFinite(v)) { a = Math.min(a, v); b = Math.max(b, v); }
    lo = [a, a, a]; hi = [b, b, b];
} else {
    lo = []; hi = [];
    for (let j = 0; j < 3; j++) {
        const vals = [];
        for (let i = 0; i < n; i++) if (Number.isFinite(out[i * 3 + j])) vals.push(out[i * 3 + j]);
        const sorted = Float64Array.from(vals).sort();
        lo.push(M.percentileFromSorted(sorted, arg.stretch[0]));
        hi.push(M.percentileFromSorted(sorted, 100 - arg.stretch[1]));
    }
}
const {cols, b} = M.foldAffine(tr, lo, hi);
const final = new Float64Array(n * 3);
for (let i = 0; i < n; i++) {
    for (let j = 0; j < 3; j++) {
        const v = data[i*3] * cols[j][0] + data[i*3+1] * cols[j][1] + data[i*3+2] * cols[j][2] + b[j];
        final[i * 3 + j] = Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : NaN;
    }
}
return __b64enc(final);
"""


@pytest.mark.parametrize("mode", MODES)
def test_dcs_math_matches_marslab_float64(app, dn, mode):
    _, kwargs = MODES[mode]
    out = app.js(_DCS_MATH_FINAL, {
        "data": base64.b64encode(np.ascontiguousarray(dn, dtype=np.float64).tobytes()).decode(),
        "sigma": kwargs["sigma"],
        "stretch": None if kwargs["contrast_stretch"] is None else list(kwargs["contrast_stretch"]),
    })
    result = np.frombuffer(base64.b64decode(out), dtype=np.float64).reshape(dn.shape)
    assert_close(result, marslab(dn, **kwargs), 1e-12, f"dcs_math {mode} vs marslab")


def test_exact_percentile_selection_on_discrete_data(app):
    """The export path's histogram + exact selection must equal numpy's
    percentile, including across gaps between repeated values (8-bit data)."""
    rng = np.random.default_rng(4)
    values = (rng.integers(0, 7, 20000) * 0.37 + 1000.0)
    ps = [0, 1, 2, 37.3, 98, 99, 100]
    got = app.js("""
        const M = await import('/utils/dcs_math.js');
        const vals = Array.from(__b64dec(arg.data, Float64Array));
        let lo = Infinity, hi = -Infinity;
        for (const v of vals) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        const N = 65536, w = (hi - lo) / N || 1;
        const binOf = v => Math.min(N - 1, Math.max(0, Math.floor((v - lo) / w)));
        const hist = new Float64Array(N);
        for (const v of vals) hist[binOf(v)]++;
        return arg.ps.map(p => {
            const {k0, k1, frac} = M.percentileRanks(vals.length, p);
            const pick = k => {
                const {bin, below} = M.locateRank(hist, k);
                return vals.filter(v => binOf(v) === bin).sort((a, b) => a - b)[k - below];
            };
            const v0 = pick(k0);
            return v0 + (pick(k1) - v0) * frac;
        });
    """, {"data": base64.b64encode(values.tobytes()).decode(), "ps": ps})
    assert_close(got, np.percentile(values, ps), 1e-12, "exact percentile selection")

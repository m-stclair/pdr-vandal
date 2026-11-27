"""
The app-side bookkeeping for PDR crop / rotate / flip and the automatic
fit-to-texture bin (utils/geometry.js),
checked against what pdrview.apply_geometry actually does to the data, and
the geometry toolbar.

PDR itself runs under Pyodide, which the browser tests stub out, so the
data transform is tested directly in test_pdrview.py and only the JS side
is tested here.
"""
import base64
import itertools

import numpy as np
import pytest

H, W = 13, 17


def _geom_js(app, body, arg=None):
    return app.js("const G = await import('/utils/geometry.js');\n" + body, arg)


def _index_planes(pdrview, geom):
    """(x, y) original-pixel coordinates of each output pixel, as pdrview
    produces them: block means of the coordinates when rebinned."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float64)
    out = pdrview.apply_geometry(np.stack([x, y]), pdrview.Geometry(**geom).resolved(H, W))
    return np.ma.filled(out, np.nan)


GEOMETRIES = [
    dict(x0=x0, y0=y0, width=w, height=h, bin=b, flip=f, rot=r)
    for (x0, y0, w, h), b, f, r in itertools.product(
        [(0, 0, W, H), (3, 2, 11, 9)], [1, 2, 3], [False, True], range(4)
    )
]


@pytest.mark.parametrize("geom", GEOMETRIES, ids=lambda g: (
    f"crop{g['x0']}-{g['y0']}_bin{g['bin']}_flip{int(g['flip'])}_rot{g['rot']}"))
def test_to_original_pixel_matches_pdrview(app, pdrview, geom):
    """For every displayed pixel, the original block the readout reports is
    the block pdrview averaged into it."""
    planes = _index_planes(pdrview, geom)
    js = _geom_js(app, """
        const [w, h] = G.outputSize(arg);
        const blocks = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) blocks.push(G.toOriginalPixel(arg, x, y));
        return {w, h, blocks};
    """, geom)
    assert (js["h"], js["w"]) == planes.shape[1:]
    centers = np.array([[(b["x0"] + b["x1"]) / 2, (b["y0"] + b["y1"]) / 2] for b in js["blocks"]])
    assert np.array_equal(centers[:, 0].reshape(js["h"], js["w"]), planes[0])
    assert np.array_equal(centers[:, 1].reshape(js["h"], js["w"]), planes[1])


def _display_op(a, op):
    """An on-screen operation on a displayed (rows, cols) array."""
    return {
        "cw": lambda m: np.rot90(m, -1, axes=(-2, -1)),
        "ccw": lambda m: np.rot90(m, 1, axes=(-2, -1)),
        "flipH": lambda m: m[..., :, ::-1],
        "flipV": lambda m: m[..., ::-1, :],
    }[op](a)


@pytest.mark.parametrize("op", ["cw", "ccw", "flipH", "flipV"])
@pytest.mark.parametrize("flip, rot", itertools.product([False, True], range(4)))
def test_orientation_buttons_act_on_what_is_displayed(app, pdrview, op, flip, rot):
    start = dict(x0=0, y0=0, width=W, height=H, bin=1, flip=flip, rot=rot)
    after = _geom_js(app, "return G.composeOrientation(arg.g, arg.op);", {"g": start, "op": op})
    shown = _index_planes(pdrview, start)
    assert np.array_equal(_index_planes(pdrview, after), _display_op(shown, op))


@pytest.mark.parametrize("geom", [g for g in GEOMETRIES if g["width"] == W and g["bin"] < 3],
                         ids=lambda g: f"bin{g['bin']}_flip{int(g['flip'])}_rot{g['rot']}")
def test_crop_to_view_keeps_the_viewed_pixels(app, pdrview, geom):
    """Cropping to a view region yields exactly the pixels that were in
    view, with the same bin and orientation."""
    shown = _index_planes(pdrview, geom)
    h, w = shown.shape[1:]
    # a region on whole-pixel boundaries of the displayed array
    region = {"u0": 1 / w, "u1": (w - 2) / w, "v0": 2 / h, "v1": (h - 1) / h}
    cropped = _geom_js(app, "return G.cropToRegion(arg.g, arg.r);", {"g": geom, "r": region})
    assert np.array_equal(_index_planes(pdrview, cropped), shown[:, 2:h - 1, 1:w - 2])


def test_clamp_matches_pdrview_resolution(app, pdrview):
    for spec in [dict(x0=-4, y0=20, width=99, height=None, bin=40, flip=1, rot=-3),
                 dict(x0=5, y0=5, width=3, height=0, bin=0, flip=0, rot=6)]:
        js = _geom_js(app, "return G.clampGeometry(arg, %d, %d);" % (W, H), spec)
        py = pdrview.Geometry(**{k: v for k, v in spec.items() if v is not None}).resolved(H, W)
        assert js == {"x0": py.x0, "y0": py.y0, "width": py.width, "height": py.height,
                      "bin": py.bin, "flip": py.flip, "rot": py.rot}


def test_bin_to_fit(app):
    assert _geom_js(app, "return [G.binToFit(16384, 100, 8192), G.binToFit(8193, 8192, 8192), "
                         "G.binToFit(100, 100, 8192)];") == [2, 2, 1]


def test_with_auto_bin(app):
    """The bin is derived from the crop alone: 1 whenever it fits."""
    out = _geom_js(app, """
        const big = G.identityGeometry(20000, 3000);
        return [
            G.withAutoBin(big, 8192).bin,
            G.withAutoBin({...big, width: 8000}, 8192).bin,
            G.withAutoBin({...big, bin: 5, width: 100, height: 100}, 8192).bin,
            G.withoutBin(G.withAutoBin(big, 8192)).bin,
        ];
    """)
    assert out == [3, 1, 1, 1]


def test_crop_of_downsampled_array_returns_to_full_resolution(app, pdrview):
    """Cropping an auto-binned display keeps the viewed region, and once the
    bin is re-derived for the smaller crop it is 1 (it used to stick)."""
    resolved = dict(x0=0, y0=0, width=W, height=H, bin=2, flip=False, rot=1)
    region = {"u0": 0.25, "u1": 0.75, "v0": 0.25, "v1": 0.75}
    out = _geom_js(app, """
        const user = G.withoutBin(G.cropToRegion(arg.g, arg.r));
        return {user, sent: G.withAutoBin(user, 12)};
    """, {"g": resolved, "r": region})
    assert out["user"]["bin"] == 1 and out["sent"]["bin"] == 1
    assert (out["user"]["flip"], out["user"]["rot"]) == (False, 1)
    # still covers the displayed block the region selected
    w, h = out["user"]["width"], out["user"]["height"]
    assert 0 < w <= W and 0 < h <= H and (w, h) != (W, H)


def test_push_history_caps_and_keeps_newest(app):
    out = _geom_js(app, """
        let s = [];
        for (let i = 0; i < 13; i++) s = G.pushHistory(s, {i}, 10);
        const before = [];
        const t = G.pushHistory(before, {i: 0});
        return {ids: s.map(e => e.i), untouched: before.length, t: t.length};
    """)
    assert out == {"ids": list(range(3, 13)), "untouched": 0, "t": 1}


def test_geometry_toolbar_replaces_panel(app):
    """Crop / rotate / flip / undo / reset are icon buttons under the
    histogram; the old panel with bin and x/y/w/h fields is gone."""
    out = app.js("""
        const tb = document.getElementById('geometryToolbar');
        const hist = document.getElementById('histogramPanel');
        return {
            after: hist.nextElementSibling === tb,
            ids: [...tb.querySelectorAll('button')].map(b => b.id),
            gone: ['geometryPanel', 'geom-bin', 'geom-x0', 'geom-width']
                .filter(id => document.getElementById(id)),
            hidden: getComputedStyle(tb).display === 'none',
        };
    """)
    assert out == {
        "after": True,
        "ids": ["geom-crop-select", "geom-crop-view", "geom-ccw", "geom-cw",
                "geom-flipH", "geom-flipV", "geom-undo", "geom-reset"],
        "gone": [],
        "hidden": False,  # it works on the start-up test pattern too
    }


@pytest.mark.parametrize("geom", GEOMETRIES, ids=lambda g: (
    f"crop{g['x0']}-{g['y0']}_bin{g['bin']}_flip{int(g['flip'])}_rot{g['rot']}"))
def test_apply_geometry_to_array_matches_pdrview(app, pdrview, geom):
    """The JS transform used for arrays made in the browser (the test
    pattern) gives exactly what pdrview.apply_geometry gives, NaNs included
    (ignored in block means; a block of only NaNs stays NaN)."""
    data = np.random.default_rng(5).random((H, W)).astype(np.float32)
    data[0, 0:3] = np.nan
    data[4:6, 4:7] = np.nan
    resolved = pdrview.Geometry(**geom).resolved(H, W)
    expected = pdrview.apply_geometry(np.ma.masked_invalid(data), resolved)
    expected = np.ma.filled(expected.astype(np.float64), np.nan)
    out = _geom_js(app, """
        const px = new Float32Array(Uint8Array.from(atob(arg.data), c => c.charCodeAt(0)).buffer);
        const r = G.applyGeometryToArray(px, arg.w, arg.h, arg.g);
        return {w: r.width, h: r.height, v: Array.from(r.pixels, v => Number.isNaN(v) ? null : v)};
    """, {"data": base64.b64encode(data.tobytes()).decode(), "w": W, "h": H,
          "g": dict(x0=resolved.x0, y0=resolved.y0, width=resolved.width,
                    height=resolved.height, bin=resolved.bin, flip=resolved.flip,
                    rot=resolved.rot)})
    got = np.array([np.nan if v is None else v for v in out["v"]]).reshape(out["h"], out["w"])
    assert got.shape == expected.shape
    np.testing.assert_allclose(got, expected, rtol=1e-6, equal_nan=True)

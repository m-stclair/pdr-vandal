"""
P0: pdrview.py normalization, the step every PDR product goes through
before the app sees it. Expected values are computed independently here.
"""
import types
from pathlib import Path

import numpy as np
import pytest

from util import assert_close, assert_equal

REPO = Path(__file__).resolve().parent.parent


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


def _zscale_cases():
    rng = np.random.default_rng(11)
    noisy = rng.normal(1000, 25, (300, 400))
    noisy.flat[rng.choice(noisy.size, 500, replace=False)] = 60000  # hot pixels
    return {
        "gaussian+outliers": noisy,
        "ramp": np.linspace(-5, 5, 5000).reshape(50, 100),
        "uniform-small": rng.random(37),
        "fewer-than-min-npixels": np.array([3.0, 1.0, 2.0]),
        "constant": np.full((10, 10), 7.0),
    }


@pytest.mark.parametrize("case", list(_zscale_cases()))
def test_zscale_limits_match_astropy(pdrview, case):
    """The vendored zscale must reproduce astropy's ZScaleInterval."""
    astropy_viz = pytest.importorskip("astropy.visualization")
    values = _zscale_cases()[case]
    expected = astropy_viz.ZScaleInterval().get_limits(values)
    assert_close(pdrview.zscale_limits(values), expected, 1e-12, f"zscale ({case})")


def test_zscale_limits_ignore_masked_and_nonfinite_without_mutating(pdrview):
    astropy_viz = pytest.importorskip("astropy.visualization")
    rng = np.random.default_rng(3)
    data = rng.normal(0, 1, 2000)
    data[::97] = np.nan
    data[5] = np.inf
    masked = np.ma.masked_array(data, mask=np.zeros_like(data, dtype=bool))
    masked[10:20] = np.ma.masked
    before = masked.data.copy()
    expected = astropy_viz.ZScaleInterval().get_limits(masked)
    assert_close(pdrview.zscale_limits(masked), expected, 1e-12, "masked zscale")
    assert_equal(masked.data, before, "input left unmodified")


def test_zscale_stats_are_in_normalized_units(pdrview):
    astropy_viz = pytest.importorskip("astropy.visualization")
    cube = _rgb_cube()
    entry, obj, cache = _objects(pdrview, 3, 20, 30)
    bp, _ = pdrview._scale_and_cache(entry, obj, "RGB", cube, pdrview._compute_stats(cube), cache)
    valid = cube.compressed()
    offset, scale = valid.min(), valid.max() - valid.min()
    zmin, zmax = astropy_viz.ZScaleInterval().get_limits(valid)
    assert_close(
        [bp.zmin, bp.zmax], [(zmin - offset) / scale, (zmax - offset) / scale],
        1e-12, "normalized zscale limits",
    )


# --- Geometry: crop / rebin / flip / rotate -------------------------------
# References are written out with explicit indexing rather than the numpy
# calls pdrview uses, so a convention error (e.g. rotation direction) fails.

def _cw(a):
    """Quarter turn clockwise as displayed (row 0 at top):
    out[i, j] = in[h - 1 - j, i]."""
    h, w = a.shape[-2:]
    out = np.empty(a.shape[:-2] + (w, h), dtype=a.dtype)
    for i in range(w):
        for j in range(h):
            out[..., i, j] = a[..., h - 1 - j, i]
    return out


def _block_nanmean(a, b):
    h, w = a.shape[-2] // b, a.shape[-1] // b
    out = np.full(a.shape[:-2] + (h, w), np.nan)
    for i in range(h):
        for j in range(w):
            block = a[..., i * b:(i + 1) * b, j * b:(j + 1) * b].reshape(a.shape[:-2] + (-1,))
            with np.errstate(invalid="ignore"):
                finite = np.isfinite(block)
                out[..., i, j] = np.where(
                    finite.any(axis=-1),
                    np.where(finite, block, 0).sum(axis=-1) / np.maximum(finite.sum(axis=-1), 1),
                    np.nan,
                )
    return out


def _filled(a):
    return np.ma.filled(np.ma.masked_invalid(np.ma.asarray(a, dtype=np.float64)), np.nan)


@pytest.mark.parametrize("flip", [False, True])
@pytest.mark.parametrize("rot", [0, 1, 2, 3])
@pytest.mark.parametrize("b", [1, 3])
def test_geometry_matches_explicit_reference(pdrview, flip, rot, b):
    rng = np.random.default_rng(3)
    a = rng.random((2, 23, 31))
    a[0, 5, 7] = np.nan
    g = pdrview.Geometry(x0=4, y0=2, width=20, height=17, bin=b, flip=flip, rot=rot).resolved(23, 31)
    expected = a[..., 2:19, 4:24]
    expected = _block_nanmean(expected, b) if b > 1 else expected
    if flip:
        expected = expected[..., :, ::-1]
    for _ in range(rot):
        expected = _cw(expected)
    out = pdrview.apply_geometry(a, g)
    # crop / flip / rotate move values exactly; block means differ from the
    # reference only by summation order
    assert_close(_filled(out), expected, 1e-12 if b > 1 else 0.0,
                 f"geometry flip={flip} rot={rot} bin={b}")
    assert out.shape[-2:] == g.output_shape()


def test_rebin_ignores_invalid_and_masks_empty_blocks(pdrview):
    a = np.arange(16, dtype=np.float64).reshape(4, 4)
    a[0, 0] = np.nan                     # partly valid block -> mean of the rest
    a[2:4, 2:4] = np.nan                 # wholly invalid block -> masked
    masked = np.ma.masked_invalid(a)
    masked[0, 1] = np.ma.masked          # masked sentinel, also ignored
    out = pdrview.rebin_mean(masked, 2)
    assert_close(_filled(out), [[(4 + 5) / 2, (2 + 3 + 6 + 7) / 4],
                                [(8 + 9 + 12 + 13) / 4, np.nan]], 1e-12, "block means")


def test_rebin_drops_partial_edge_blocks(pdrview):
    out = pdrview.rebin_mean(np.ones((7, 9)), 2)
    assert out.shape == (3, 4)


def test_geometry_resolution_clamps(pdrview):
    g = pdrview.Geometry(x0=-5, y0=8, width=1000, height=None, bin=50, rot=-1).resolved(10, 20)
    assert g == pdrview.Geometry(0, 8, 20, 2, 2, False, 3)


def test_parse_geometry(pdrview):
    assert pdrview.parse_geometry(None) is None
    assert pdrview.parse_geometry("null") is None
    assert pdrview.parse_geometry("") is None
    assert pdrview.parse_geometry(pdrview.jsnull) is None   # JS null via Pyodide
    g = pdrview.parse_geometry('{"x0": 1, "y0": 2, "width": 3, "height": 4, "bin": 1, "flip": true, "rot": 1}')
    assert g == pdrview.Geometry(1, 2, 3, 4, 1, True, 1)
    with pytest.raises(ValueError):
        pdrview.parse_geometry('{"angle": 45}')


def _loaded(pdrview, masked, bands):
    """A LoadResult for an in-memory masked array, with the source array
    already in the pixel cache, so no file is read."""
    h, w = masked.shape[-2:]
    entry, obj, cache = _objects(pdrview, bands, h, w)
    entry.objects["IMAGE"] = obj
    cache.put(("test.img", "IMAGE", None), masked)
    return pdrview.LoadResult(ok=True, entry=entry), obj, cache


def test_transformed_band_has_its_own_stats_and_cache_entry(pdrview):
    """Stats, scale and offset come from the transformed array, and the
    untransformed band is cached separately and unaffected."""
    cube = _rgb_cube()
    result, obj, cache = _loaded(pdrview, cube, 3)
    full_bp, full = pdrview.get_scaled_rgba_bip(result, "IMAGE", 0, cache)

    g = pdrview.Geometry(x0=6, y0=3, width=12, height=10, bin=2, rot=1)
    bp, scaled = pdrview.get_scaled_rgba_bip(result, "IMAGE", 0, cache, geometry=g)
    region = _cw(_block_nanmean(_filled(cube[0])[3:13, 6:18], 2))
    valid = region[np.isfinite(region)]
    offset, scale = valid.min(), valid.max() - valid.min()
    assert (bp.width, bp.height) == (5, 6)
    assert_close([bp.offset, bp.scale, bp.mean], [offset, scale, (valid.mean() - offset) / scale],
                 1e-9, "transformed stats")
    assert_close(scaled.reshape(6, 5), (region - offset) / scale, 1e-6, "transformed pixels")

    again_bp, again = pdrview.get_scaled_rgba_bip(result, "IMAGE", 0, cache)
    assert again_bp is full_bp and again is full


def test_identity_geometry_shares_untransformed_entry(pdrview):
    cube = _rgb_cube()
    result, obj, cache = _loaded(pdrview, cube, 3)
    bp, arr = pdrview.get_scaled_rgba_bip(result, "IMAGE", "RGB", cache)
    whole = pdrview.Geometry(0, 0, 30, 20)
    bp2, arr2 = pdrview.get_scaled_rgba_bip(result, "IMAGE", "RGB", cache, geometry=whole)
    assert bp2 is bp and arr2 is arr


def test_rescale_after_eviction_keeps_geometry(pdrview):
    cube = _rgb_cube()
    result, obj, cache = _loaded(pdrview, cube, 3)
    g = pdrview.Geometry(x0=1, y0=1, width=15, height=9, flip=True)
    bp, first = pdrview.get_scaled_rgba_bip(result, "IMAGE", "RGB", cache, geometry=g)
    first = first.copy()
    cache._cache.pop(("test.img", "IMAGE", "RGB", g.resolved(20, 30)))
    bp2, again = pdrview.get_scaled_rgba_bip(result, "IMAGE", "RGB", cache, geometry=g)
    assert bp2 is bp
    assert_equal(again, first, "re-scaled transformed RGB")


# --- Label / header sections for the metadata pane (get_product_label) ---------
# Small synthetic products, so the tests need no external data.

_PDS3_LINES = [
    "PDS_VERSION_ID = PDS3", "RECORD_TYPE = FIXED_LENGTH", "RECORD_BYTES = 4",
    "FILE_RECORDS = {nfile}", "LABEL_RECORDS = {nlabel}", "^IMAGE = {start}",
    "EXPOSURE_DURATION = 20.6 <ms>",
    "GROUP = RSM_ARTICULATION_STATE",
    "  ARTICULATION_DEVICE_TEMP = (-22.8057 <degC>, 5.0 <degC>)",
    '  ARTICULATION_DEVICE_TEMP_NAME = ("NAVCAM LEFT CAMERA PLATE", "NAVCAM RIGHT CAMERA PLATE")',
    "  ARTICULATION_DEV_VECTOR = (1.0, 2.0, 3.0)",
    '  ARTICULATION_DEV_VECTOR_NAME = ("A", "B", "C", "D", "E", "F", "G")',
    "END_GROUP = RSM_ARTICULATION_STATE",
    "OBJECT = IMAGE", "  LINES = 3", "  LINE_SAMPLES = 4", "  SAMPLE_BITS = 8",
    "  SAMPLE_TYPE = MSB_UNSIGNED_INTEGER", "END_OBJECT = IMAGE", "END",
]
_PDS3_LABEL_RECORDS = 40   # 160 bytes of label, then 12 bytes of image


def _write_pds3(path):
    """A 4 x 3 uint8 image with an attached PDS3 label (CRLF line ends)."""
    n = _PDS3_LABEL_RECORDS
    text = "\r\n".join(_PDS3_LINES).format(nfile=n + 3, nlabel=n, start=n + 1) + "\r\n"
    path.write_bytes(text.encode().ljust(4 * n, b" ") + bytes(range(12)))
    return str(path)


_PDS4_LABEL = """<?xml version="1.0" encoding="UTF-8"?>
<Product_Observational xmlns="http://pds.nasa.gov/pds4/pds/v1"
    xmlns:cots_camera="http://pds.nasa.gov/pds4/mission/cots_camera/v1">
  <Identification_Area>
    <logical_identifier>urn:nasa:pds:test:data:t</logical_identifier>
    <version_id>1.0</version_id>
    <title>Moon &lt;test&gt;</title>
    <information_model_version>1.20.0.0</information_model_version>
    <product_class>Product_Observational</product_class>
  </Identification_Area>
  <Observation_Area>
    <Observing_System>
      <Observing_System_Component><name>Orion</name><type>Host</type></Observing_System_Component>
      <Observing_System_Component><name>Nikon</name><type>Instrument</type></Observing_System_Component>
    </Observing_System>
    <Discipline_Area>
      <cots_camera:Optics>
        <cots_camera:exit_pupil_position unit="mm">89.0</cots_camera:exit_pupil_position>
      </cots_camera:Optics>
    </Discipline_Area>
  </Observation_Area>
  <File_Area_Observational>
    <File><file_name>{data_file}</file_name></File>
    <Array_2D_Image>
      <offset unit="byte">{offset}</offset>
      <axes>2</axes>
      <axis_index_order>Last Index Fastest</axis_index_order>
      <Element_Array><data_type>UnsignedByte</data_type></Element_Array>
      <Axis_Array><axis_name>Line</axis_name><elements>{lines}</elements><sequence_number>1</sequence_number></Axis_Array>
      <Axis_Array><axis_name>Sample</axis_name><elements>{samples}</elements><sequence_number>2</sequence_number></Axis_Array>
    </Array_2D_Image>
  </File_Area_Observational>
</Product_Observational>
"""


def _write_pds4(label_path, data_file, offset=0, lines=3, samples=4):
    text = _PDS4_LABEL.format(data_file=data_file, offset=offset, lines=lines, samples=samples)
    label_path.write_text(text)
    return text


def _vicar_label(items, lblsize):
    """VICAR label text: LBLSIZE first, items two spaces apart, space-padded."""
    text = f"LBLSIZE={lblsize}".ljust(24) + "  ".join(items)
    assert len(text) <= lblsize, len(text)
    return text.encode().ljust(lblsize, b" ")


_VICAR_ITEMS = [
    "FORMAT='BYTE'", "TYPE='IMAGE'", "RECSIZE=40", "ORG='BSQ'", "NL=3", "NS=40", "NB=1",
    "N1=40", "N2=3", "N3=1", "NLB=0", "EOL={eol}",
    "PROPERTY='CAMERA'", "EXPOSURE=20.6", "FILTER=(1,2,'r''g')", "NOTE='it''s <b>'",
    "TASK='LABEL'", "USER='tester'", "DAT_TIM='Thu Nov 26 2026'",
]


def _write_vicar(path, eol=False):
    """40 x 3 byte image with a 280-byte VICAR label (and an EOL label)."""
    items = [i.format(eol=int(eol)) for i in _VICAR_ITEMS]
    body = _vicar_label(items, 280) + bytes(120)
    if eol:
        body += _vicar_label(["TASK='EOLTASK'", "USER='later'", "STEP=2"], 80)
    path.write_bytes(body)
    return str(path)


def _sections(pdrview, path):
    import json
    result = pdrview.get_product_label(str(path))
    assert result["ok"], result
    return json.loads(result["sections"])


def _tree_find(node, key):
    if node["key"] == key:
        return node
    for child in node.get("children", []):
        found = _tree_find(child, key)
        if found:
            return found


def _walk(node):
    yield node
    for child in node.get("children", []):
        yield from _walk(child)


def test_pds4_label_tree_keeps_repeats_and_units(pdrview, tmp_path):
    (tmp_path / "t.dat").write_bytes(bytes(range(12)))
    text = _write_pds4(tmp_path / "t.xml", "t.dat")
    [label] = _sections(pdrview, tmp_path / "t.xml")
    assert label["kind"] == "PDS4" and label["error"] is None
    tree = label["tree"]
    assert tree["key"] == "Product_Observational"
    nodes = list(_walk(tree))
    # the metadata MultiDict collapses repeats; the label tree must not
    assert sum(n["key"] == "Observing_System_Component" for n in nodes) == 2
    pupil = _tree_find(tree, "cots_camera:exit_pupil_position")
    assert pupil["value"] == "89.0" and pupil["unit"] == "mm"
    assert _tree_find(tree, "title")["value"] == "Moon <test>"
    assert label["raw"] == text


def test_pds3_header_becomes_tree_and_raw(pdrview, tmp_path):
    [label] = _sections(pdrview, _write_pds3(tmp_path / "T.IMG"))
    assert label["kind"] == "PDS3" and label["title"] == "T.IMG"
    exposure = _tree_find(label["tree"], "EXPOSURE_DURATION")
    assert exposure["value"] == "20.6" and exposure["unit"] == "ms"
    assert _tree_find(label["tree"], "RSM_ARTICULATION_STATE")["children"]
    raw = label["raw"]
    assert raw.startswith("PDS_VERSION_ID") and raw.rstrip().endswith("END")
    assert "\r" not in raw


def test_pds3_parallel_name_arrays_are_paired(pdrview, tmp_path):
    [label] = _sections(pdrview, _write_pds3(tmp_path / "T.IMG"))
    tree = label["tree"]
    state = _tree_find(tree, "RSM_ARTICULATION_STATE")
    temps = _tree_find(state, "ARTICULATION_DEVICE_TEMP")
    row = _tree_find(temps, "NAVCAM LEFT CAMERA PLATE")
    assert row["value"] == "-22.8057" and row["unit"] == "degC"
    assert not any(c["key"] == "ARTICULATION_DEVICE_TEMP_NAME" for c in state["children"])
    # unequal lengths (3 values, 7 names) are left alone as one tuple row
    vector = _tree_find(tree, "ARTICULATION_DEV_VECTOR")
    assert vector["value"].startswith("(") and "children" not in vector
    assert _tree_find(tree, "ARTICULATION_DEV_VECTOR_NAME")


def test_pds4_label_and_attached_pds3_header_are_both_shown(pdrview, tmp_path):
    img = _write_pds3(tmp_path / "T.IMG")
    _write_pds4(tmp_path / "T.xml", "T.IMG", offset=4 * _PDS3_LABEL_RECORDS)
    sections = _sections(pdrview, img)
    assert [s["kind"] for s in sections] == ["PDS4", "PDS3"]
    assert sections[1]["title"] == "label in T.IMG"
    assert _tree_find(sections[1]["tree"], "EXPOSURE_DURATION")["unit"] == "ms"


def test_unlabeled_product_has_no_sections(pdrview, tmp_path):
    path = tmp_path / "plain.txt"
    path.write_text("not a PDS label\n")
    assert _sections(pdrview, path) == []


def _vicar_checks(section):
    assert section["kind"] == "VICAR" and section["error"] is None, section
    groups = {g["key"]: g for g in section["tree"]["children"]}
    assert list(groups)[:3] == ["System", "PROPERTY CAMERA", "TASK LABEL"]
    assert _tree_find(groups["System"], "LBLSIZE")["value"] == "280"
    assert _tree_find(groups["PROPERTY CAMERA"], "NOTE")["value"] == "it's <b>"
    assert _tree_find(groups["PROPERTY CAMERA"], "FILTER")["value"] == "(1, 2, r'g)"
    assert _tree_find(groups["TASK LABEL"], "USER")["value"] == "tester"
    assert "NOTE='it''s <b>'" in section["raw"]
    return groups


def test_pds4_label_over_vicar_file(pdrview, tmp_path):
    """M2020 / MSL style: a PDS4 label describing a VICAR file."""
    _write_vicar(tmp_path / "v.VIC")
    _write_pds4(tmp_path / "v.xml", "v.VIC", offset=280, lines=3, samples=40)
    sections = _sections(pdrview, tmp_path / "v.xml")
    assert [s["kind"] for s in sections] == ["PDS4", "VICAR"]
    assert sections[1]["title"] == "header in v.VIC"
    _vicar_checks(sections[1])


def test_vicar_end_of_file_label_is_read(pdrview, tmp_path):
    _write_vicar(tmp_path / "v.VIC", eol=True)
    _write_pds4(tmp_path / "v.xml", "v.VIC", offset=280, lines=3, samples=40)
    vicar = _sections(pdrview, tmp_path / "v.xml")[1]
    groups = _vicar_checks(vicar)
    assert _tree_find(groups["EOL TASK EOLTASK"], "STEP")["value"] == "2"
    assert "--- EOL label ---" in vicar["raw"]


def test_pds3_label_with_embedded_vicar_header(pdrview, tmp_path):
    """Cassini ISS / Voyager style: PDS3 label, then a VICAR header object."""
    record, nlabel = 40, 12
    lines = [
        "PDS_VERSION_ID = PDS3", "RECORD_TYPE = FIXED_LENGTH", f"RECORD_BYTES = {record}",
        "FILE_RECORDS = 22", f"LABEL_RECORDS = {nlabel}",
        f"^IMAGE_HEADER = {nlabel + 1}", f"^IMAGE = {nlabel + 8}",
        "OBJECT = IMAGE_HEADER", "  BYTES = 280", "  RECORDS = 7", "  HEADER_TYPE = VICAR2",
        "  INTERCHANGE_FORMAT = ASCII", "END_OBJECT = IMAGE_HEADER",
        "OBJECT = IMAGE", "  LINES = 3", "  LINE_SAMPLES = 40", "  SAMPLE_BITS = 8",
        "  SAMPLE_TYPE = MSB_UNSIGNED_INTEGER", "END_OBJECT = IMAGE", "END",
    ]
    label = ("\r\n".join(lines) + "\r\n").encode().ljust(nlabel * record, b" ")
    vicar = _vicar_label([i.format(eol=0) for i in _VICAR_ITEMS], 280)
    (tmp_path / "C.IMG").write_bytes(label + vicar + bytes(120))
    sections = _sections(pdrview, tmp_path / "C.IMG")
    assert [s["kind"] for s in sections] == ["PDS3", "VICAR"]
    assert sections[1]["title"] == "IMAGE_HEADER in C.IMG"
    _vicar_checks(sections[1])


def test_malformed_vicar_header_is_an_error_section(pdrview, tmp_path):
    """A broken header yields an error section; the label still shows."""
    (tmp_path / "v.VIC").write_bytes(b"LBLSIZE=99999999999 " + bytes(200))
    _write_pds4(tmp_path / "v.xml", "v.VIC", offset=0, lines=1, samples=4)
    pds4, vicar = _sections(pdrview, tmp_path / "v.xml")
    assert pds4["kind"] == "PDS4" and pds4["error"] is None and pds4["tree"]
    assert vicar["kind"] == "VICAR" and vicar["tree"] is None
    assert "LBLSIZE" in vicar["error"]


def _write_fits(path):
    from astropy.io import fits
    primary = fits.PrimaryHDU(np.zeros((3, 4), np.float32))
    primary.header["EXPTIME"] = (20.6, "[s] exposure <time>")
    primary.header.add_history("step one")
    primary.header.add_history("step two")
    sci = fits.ImageHDU(np.ones((2, 2), np.int16), name="SCI")
    fits.HDUList([primary, sci]).writeto(path, overwrite=True)
    return str(path)


def _fits_checks(section):
    assert section["kind"] == "FITS" and section["error"] is None, section
    hdus = section["tree"]["children"]
    assert [h["key"] for h in hdus] == ["HDU 0 (PRIMARY)", "HDU 1 (SCI)"]
    exptime = _tree_find(hdus[0], "EXPTIME")
    assert exptime["value"] == "20.6" and exptime["comment"] == "[s] exposure <time>"
    history = [c["value"] for c in hdus[0]["children"] if c["key"] == "HISTORY"]
    assert history == ["step one", "step two"]
    assert _tree_find(hdus[0], "SIMPLE")["value"] == "T"
    raw = section["raw"]
    assert "--- HDU 1 (SCI) ---" in raw and "EXPTIME =" in raw


def test_standalone_fits_headers(pdrview, tmp_path):
    [section] = _sections(pdrview, _write_fits(tmp_path / "f.fits"))
    assert section["title"] == "f.fits"
    _fits_checks(section)


def test_pds3_label_over_fits_file(pdrview, tmp_path):
    _write_fits(tmp_path / "F.FIT")
    (tmp_path / "F.LBL").write_text("\r\n".join([
        "PDS_VERSION_ID = PDS3", "RECORD_TYPE = FIXED_LENGTH", "RECORD_BYTES = 2880",
        '^IMAGE = ("F.FIT", 2)', "OBJECT = IMAGE", "  LINES = 3", "  LINE_SAMPLES = 4",
        "  SAMPLE_BITS = 32", "  SAMPLE_TYPE = IEEE_REAL", "END_OBJECT = IMAGE", "END",
    ]) + "\r\n")
    sections = _sections(pdrview, tmp_path / "F.LBL")
    assert [s["kind"] for s in sections] == ["PDS3", "FITS"]
    _fits_checks(sections[1])


def test_real_compressed_fits_headers(pdrview):
    """A real GALEX product (gzipped FITS, several HDUs)."""
    path = REPO / "test_data" / "e31462-fd-ffull-b00-image-g.fits.gz"
    if not path.exists():
        pytest.skip(f"{path.name} not present (test_data/ is not in git)")
    [section] = _sections(pdrview, path)
    assert section["kind"] == "FITS" and section["error"] is None, section
    hdus = section["tree"]["children"]
    assert [h["key"] for h in hdus][:2] == ["HDU 0 (PRIMARY)", "HDU 1 (COUNT)"]
    assert _tree_find(hdus[1], "TELESCOP")["value"] == "GALEX"
    assert _tree_find(hdus[1], "NAXIS1")["value"] == "3103"
    assert "--- HDU 1 (COUNT) ---" in section["raw"]


def test_tiff_tags_with_binary_values_elided(pdrview, tmp_path):
    from PIL import Image, TiffImagePlugin
    tags = TiffImagePlugin.ImageFileDirectory_v2()
    tags[270] = "desc <x>"          # ImageDescription
    tags[305] = "vandal tests"      # Software
    tags[37500] = b"\x00" * 1000    # MakerNote
    Image.fromarray(np.arange(12, dtype=np.uint8).reshape(3, 4)).save(
        tmp_path / "t.tif", tiffinfo=tags)
    [section] = _sections(pdrview, tmp_path / "t.tif")
    assert section["kind"] == "TIFF" and section["error"] is None
    tree = section["tree"]
    assert _tree_find(tree, "ImageDescription")["value"] == "desc <x>"
    assert _tree_find(tree, "Software")["value"] == "vandal tests"
    assert _tree_find(tree, "MakerNote")["value"] == "<1000 bytes>"
    assert not _tree_find(tree, "fn")          # no local path leaked

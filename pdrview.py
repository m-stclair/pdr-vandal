import dataclasses
import json
from typing import Literal

import multidict
import numpy as np
import pdr
from pyodide.ffi import to_js


def to_js_unproxied(*args, **kwargs):
    return to_js(*args, **kwargs, create_pyproxies=False)


@dataclasses.dataclass
class ArrayInfo:
    width: int
    height: int
    bands: int
    json_meta: str


@dataclasses.dataclass
class BandPixels:
    pixels: np.ndarray  # always 0-1 f32
    # currently, should always be 1 or 3. if 1, we expect pixels to just be
    # the raveled array. if 3, we expect it to be a contiguous BIP
    # [r, g, b, r, g, b] array.
    channels: int
    scale: float
    offset: float
    # these statistics are all also scaled/offset to the 0-1 array
    mean: float
    std: float
    p02: float
    p98: float


# TODO: decide how many of these we actually want to cache
@dataclasses.dataclass
class ArrayObject:
    band_pixels: dict[str | int, BandPixels]
    info: ArrayInfo
    # MaskedArray with nonfinite values & special constants masked
    masked: np.ndarray | None = None


@dataclasses.dataclass
class DummyObject:
    pass


@dataclasses.dataclass
class RegistryEntry:
    data: pdr.Data
    objects: dict[str, ArrayObject | DummyObject]
    populated: bool = False


DATA_REGISTRY: dict[str, RegistryEntry] = {}


def _just_load_and_check_array_shape(
    data, objname
) -> tuple[dict | None, bool]:
    arr = data[objname]
    delattr(data, objname)
    if not isinstance(arr, np.ndarray):
        return None, False
    if len(arr.shape) == 3:
        bands = arr.shape[0]
        width, height = (arr.shape[2], arr.shape[1])
    elif len(arr.shape) == 2:
        bands = 1
        width, height = (arr.shape[1], arr.shape[0])
    else:
        # not dealing with 1-D arrays
        return None, False
    return {'bands': bands, 'width': width, 'height': height}, True


# TODO: this might be a little fragile
def init_array_object(data: pdr.Data, objname: str) -> ArrayObject | None:
    from pdr.loaders.utility import DESKTOP_IMAGE_STANDARDS

    dims, block = {}, None

    if data.standard == 'PDS4' and objname in data._pds4_structures:
        structure = data._pds4_structures[objname]
        if not hasattr(structure, "type"):
            return None
        if structure.type not in ('Array_3D_Image', 'Array_2D_Image'):
            return None
        axis_array = structure.meta_data['Axis_Array']
        for a in axis_array:
            if a['axis_name'] == 'Line':
                dims['height'] = a['elements']
            elif a['axis_name'] == 'Sample':
                dims['width'] = a['elements']
            elif a['axis_name'] == 'Band':
                dims['bands'] = a['elements']
        if dims.get('bands') is None:
            dims['bands'] = 1
    elif data.standard == 'FITS':
        from astropy.io import fits
        info = fits.info(data.filename, False)
        for hdu in info:
            (_ix, extname, _ver, exttype, _cards, dimensions, _fmt, _) = hdu
            if extname != objname:
                continue
            if exttype not in ('PrimaryHDU', 'ImageHDU', 'CompImageHDU'):
                return None
            if len(dimensions) == 2:
                dims['bands'] = 1
            elif len(dimensions) == 3:
                dims['bands'] = dimensions[2]
            else:
                # 1-D arrays and > 3-D arrays not supported;
                # this case also covers 0-D 'stub' HDUs
                return None
            dims['width'] = dimensions[0]
            dims['height'] = dimensions[1]
    elif data.standard == 'PDS3':
        from pdr.formats.checkers import check_special_block
        from pdr.loaders.datawrap import (
            ReadCompressedImage, ReadImage, ReadFits
        )
        from pdr.loaders.dispatch import pointer_to_loader

        loader = pointer_to_loader(objname, data)
        if not isinstance(loader, (ReadImage, ReadFits, ReadCompressedImage)):
            return None

        is_special, block = check_special_block(
            objname, data, data.identifiers
        )
        ok = True
        if not is_special:
            block = data.metablock_(objname)
        if block is None:
            dims, ok = _just_load_and_check_array_shape(data, objname)
        else:
            dims['width'] = block.get('LINES')
            dims['height'] = block.get('LINE_SAMPLES')
            dims['bands'] = block.get('BANDS', 1)
        if any(d is None for d in dims.values()):
            dims, ok = _just_load_and_check_array_shape(data, objname)
        if not ok:
            return None
    elif data.standard in DESKTOP_IMAGE_STANDARDS:
        from PIL import Image

        im = Image.open(data.filename)
        dims['width'] = im.width
        dims['height'] = im.height
        if im.mode in (1, "L", "I", "F"):
            dims['bands'] = 1
        elif im.mode in ('CMYK', 'RGBA'):
            dims['bands'] = 4
        elif im.mode in ('RGB', 'LAB', 'HSV', 'YCbCr'):
            dims['bands'] = 3
        else:
            dims, ok = _just_load_and_check_array_shape(data, objname)
            if not ok:
                return None
    else:
        dims, ok = _just_load_and_check_array_shape(data, objname)
        if not ok:
            return None
    if block is None:
        meta = (
            dict(data.metablock(objname))
            if data.metablock(objname) is not None
            else dict(data.metadata)
        )
    else:
        meta = block
    info = ArrayInfo(json_meta=to_json_safe(meta), **dims)
    return ArrayObject(info=info, band_pixels={})


def populate_registry_entry(entry: RegistryEntry):
    data, objects = entry.data, entry.objects
    for objname in data.keys():
        obj = init_array_object(data, objname)
        if obj is None:
            obj = DummyObject()
        objects[objname] = obj
    entry.populated = True


# TODO: right now, this unconditionally clears all previous entries from the
#  cache. We probably want to be smarter about this. But our memory is very
#  limited.
def clear_cache(path):
    for p in tuple(DATA_REGISTRY.keys()):
        if p != path:
            del DATA_REGISTRY[p]


@dataclasses.dataclass
class LoadResult:
    ok: bool
    entry: RegistryEntry | None = None
    error: Exception | None = None


def load_if_required(path: str) -> LoadResult:
    if path in DATA_REGISTRY.keys():
        return LoadResult(ok=True, entry=DATA_REGISTRY[path])
    try:
        data = pdr.read(path)
    except Exception as e:
        return LoadResult(ok=False, error=e)
    clear_cache(path)
    entry = RegistryEntry(data=data, objects={})
    populate_registry_entry(entry)
    DATA_REGISTRY[path] = entry
    return LoadResult(ok=True, entry=entry)


def prep_masked_array(data: pdr.Data, objname: str) -> np.ma.MaskedArray:
    data.load(objname, reload=True)
    arr = data.get_scaled(objname)
    delattr(data, objname)
    arr = np.ma.masked_invalid(arr)
    return arr


def _compute_stats(pixels: np.ndarray) -> dict:
    flat = pixels.compressed() if isinstance(pixels, np.ma.MaskedArray) else pixels.ravel()
    flat = flat[np.isfinite(flat)]
    p02, p98 = np.percentile(flat, [2, 98])
    return {
        'mean': float(np.mean(flat)),
        'std': float(np.std(flat)),
        'p02': float(p02),
        'p98': float(p98),
    }


def _scale_and_set(
    obj: ArrayObject,
    band: int | Literal["RGB"],
    pixels: np.ndarray,
    raw_stats: dict
) -> BandPixels:
    if not isinstance(band, int):
        if not pixels.ndim == 3 and pixels.shape[0] == 3:
            raise ValueError("Must be a 3-band BSQ array")
    elif pixels.ndim != 2:
        raise ValueError("Must be a 2-D array")
    offset = np.nanmin(pixels)
    scale = np.nanmax(pixels) - offset
    scaled = ((pixels - offset) / scale).astype('f4')
    if isinstance(scaled, np.ma.MaskedArray):
        scaled[scaled.mask] = np.nan
        scaled = scaled.data

    # transform stats into 0-1 space
    def rescale(v):
        return (v - offset) / scale

    if not isinstance(band, int):
        scaled = bsq_to_bip_1d(scaled)
        channels = 3
    else:
        scaled = scaled.ravel()
        channels = 1

    bandpixels = BandPixels(
        pixels=scaled,
        scale=scale, offset=offset,
        mean=rescale(raw_stats['mean']),
        std=raw_stats['std'] / scale,
        p02=rescale(raw_stats['p02']),
        p98=rescale(raw_stats['p98']),
        channels=channels
    )
    obj.band_pixels[band] = bandpixels
    return bandpixels


def _get_set_grayscale(obj: ArrayObject, band: int) -> BandPixels:
    if (bandpixels := obj.band_pixels.get(band)) is not None:
        return bandpixels
    if obj.info.bands == 1:
        band = 0
        arr = obj.masked
    else:
        arr = obj.masked[band]
    raw_stats = _compute_stats(arr)
    return _scale_and_set(obj, band, arr, raw_stats)


def get_scaled_rgba_bip(
    result: LoadResult, objname: str, band: str | int | None = None
) -> BandPixels:
    entry = result.entry
    if objname not in entry.objects:
        raise ValueError(f"no array named {objname} in {entry.data.filename}")
    obj = entry.objects[objname]
    if isinstance(obj, DummyObject):
        raise TypeError(f"{objname} is not an array")
    if obj.masked is None:
        masked = prep_masked_array(entry.data, objname)
        obj.masked = masked
    # 2D array case (always grayscale)
    if obj.info.bands == 1:
        return _get_set_grayscale(obj, 0)
    # default RGB case
    # TODO: implement arbitrary 3-band mapping
    if not isinstance(band, int) and obj.info.bands in (3, 4):
        if (pixels := obj.band_pixels.get("RGB")) is not None:
            return pixels
        arr = obj.masked[:3]
        raw_stats = _compute_stats(arr)
        return _scale_and_set(obj, "RGB", arr, raw_stats)
    # single-band selection from multiband array case
    if not isinstance(band, int):
        band = obj.info.bands // 2
    return _get_set_grayscale(obj, band)


def to_json_safe(meta: dict | multidict.MultiDict):
    """
    Flatten MultiDicts into dicts; discard repeated keys,
    stringify stuff. a little inefficient but these structures
    aren't that large.
    """
    if isinstance(meta, multidict.MultiDict):
        meta = dict(meta)
    if isinstance(meta, dict):
        return {k: to_json_safe(v) for k, v in meta.items()}
    elif isinstance(meta, (list, tuple)):
        return [to_json_safe(i) for i in meta]
    try:
        json.dumps(meta)
        return meta
    except TypeError:
        return str(meta)


def get_first_array_objname(data: pdr.Data) -> str:
    if len(objnames := get_array_objnames(data)) == 0:
        raise ValueError(f"No images in {data.filename}")
    return objnames[0]


def get_array_objnames(data: pdr.Data) -> list[str]:
    return [
        k for k in data.keys() if isinstance(data[k], np.ndarray)
    ]


def get_array_image(
        path: str,
        objname: str | None = None,
        band: str | int | None = None
):
    try:
        result = load_if_required(path)
        if not result.ok:
            raise ValueError(f"Failed to load {path}: {result.error}")
        bandpixels = get_scaled_rgba_bip(result, objname, band)
        info = result.entry.objects[objname].info
        return to_js_unproxied({
            "ok": True,
            "pixels": bandpixels.pixels,
            "scale": float(bandpixels.scale),
            "offset": float(bandpixels.offset),
            "width": int(info.width),
            "height": int(info.height),
            "channels": int(bandpixels.channels),
            "mean": float(bandpixels.mean),
            "std": float(bandpixels.std),
            "p02": float(bandpixels.p02),
            "p98": float(bandpixels.p98),
        })
    except Exception as e:
        return to_js_unproxied({
            "ok": False, "error": f"{type(e).__name__}: {e}"
        })


def get_product_info(path: str) -> str:
    result = load_if_required(path)
    if not result.ok:
        return to_js_unproxied({
            "ok": False,
            "error": f"{type(result.error).__name__}: {result.error}",
        })
    out = {}
    for objname, obj in result.entry.objects.items():
        if isinstance(obj, DummyObject):
            continue
        out[objname] = dataclasses.asdict(obj.info)
    return to_js_unproxied({"ok": True, "objects": json.dumps(out)})


def bsq_to_bip_1d(bsq: np.ndarray) -> np.ndarray:
    """
    Repack a 3-band BSQ array into a flat 1-D BIP array suitable
    for upload as a WebGL RGB32F texture.

    Parameters
    ----------
    bsq : np.ndarray
        Shape (3, H, W), any numeric dtype. Band order is
        preserved as-is (caller decides R/G/B semantics).

    Returns
    -------
    np.ndarray
        Shape (H * W * 3,), dtype float32, interleaved as
        R0 G0 B0  R1 G1 B1  ...  Rn Gn Bn  in row-major order
    """
    if bsq.ndim != 3 or bsq.shape[0] != 3:
        raise ValueError(f"Expected shape (3, H, W), got {bsq.shape}. ")

    bip = np.moveaxis(bsq, 0, -1)  # view, no copy yet
    return np.ascontiguousarray(bip, dtype=np.float32).ravel()

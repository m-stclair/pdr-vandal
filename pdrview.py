import dataclasses
import json

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
    pixels: np.ndarray  # always 0-1 f32 padded to RGBA BIP
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


def init_array_object(data: pdr.Data, objname: str) -> ArrayObject | None:
    arr = data[objname]
    if not isinstance(arr, np.ndarray):
        return None
    if len(arr.shape) == 3:
        bands = arr.shape[0]
        width, height = (arr.shape[2], arr.shape[1])
    elif len(arr.shape) == 2:
        bands = 1
        width, height = (arr.shape[1], arr.shape[0])
    else:
        # not dealing with 1-D arrays
        return None
    meta = (
        dict(data.metablock(objname))
        if data.metablock(objname) is not None
        else dict(data.metadata)
    )
    info = ArrayInfo(
        json_meta=to_json_safe(meta), height=height, width=width, bands=bands
    )
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
    """pixels here is a raw single-band or pre-pad array, no alpha contamination"""
    flat = pixels.compressed() if isinstance(pixels, np.ma.MaskedArray) else pixels.ravel()
    flat = flat[np.isfinite(flat)]
    p02, p98 = np.percentile(flat, [2, 98])
    return {
        'mean': float(np.mean(flat)),
        'std': float(np.std(flat)),
        'p02': float(p02),
        'p98': float(p98),
    }


def _scale_and_set(obj, band, pixels, raw_stats) -> BandPixels:
    offset = np.nanmin(pixels)
    scale = np.nanmax(pixels) - offset
    scaled = ((pixels - offset) / scale).astype('f4')
    if isinstance(scaled, np.ma.MaskedArray):
        scaled[scaled.mask] = np.nan
        scaled = scaled.data

    # transform stats into 0-1 space
    def rescale(v):
        return (v - offset) / scale

    padded = to_rgba_bip_1d(scaled)
    bandpixels = BandPixels(
        pixels=padded,
        scale=scale, offset=offset,
        mean=rescale(raw_stats['mean']),
        std=raw_stats['std'] / scale,
        p02=rescale(raw_stats['p02']),
        p98=rescale(raw_stats['p98']),
    )
    obj.band_pixels[band] = bandpixels
    return bandpixels


def _get_set_grayscale(obj: ArrayObject, band: int) -> BandPixels:
    print("grayscale path")
    if (bandpixels := obj.band_pixels.get(band)) is not None:
        return bandpixels
    if obj.info.bands == 1:
        print("singleband path")
        band = 0
        arr = obj.masked
    else:
        print(f"multiband path at band {band}")
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
        print(f"setting masked for {objname}")
        print(f"masked shape is {masked.shape}")
        obj.masked = masked
    # NOTE: these look repetitive, but they're legitimately distinct cases
    # 2D array case (always grayscale)
    if obj.info.bands == 1:
        return _get_set_grayscale(obj, 0)
    # RGB case
    # TODO: this is 'default' RGB. if we implement arbitrary 3-band
    #  mapping, that's yet another case
    if not isinstance(band, int) and obj.info.bands in (3, 4):
        if (pixels := obj.band_pixels.get("RGB")) is not None:
            return pixels
        arr = obj.masked[:3]
        raw_stats = _compute_stats(arr)
        return _scale_and_set(obj, "RGB", arr, raw_stats)
    # TODO: add arbitrary RGB band selection
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


def to_rgba_bip_1d(arr: np.ndarray) -> np.ndarray:
    """
    Convert an input ndarray to a 1-D RGBA BIP array.

    Cases handled:
    1) 2D array (H, W): treated as grayscale
       -> [x1, x1, x1, 1, x2, x2, x2, 1, ...]
    2) 3D BSQ array (3, H, W): treated as (R, G, B)
       -> [r1, g1, b1, 1, r2, g2, b2, 1, ...]

    Returns
    -------
    np.ndarray
        Flattened 1-D array in RGBA BIP order.

    Raises
    ------
    ValueError
        If input is not 2D or not a 3-band BSQ 3D array.
    """
    arr = np.asarray(arr)

    if arr.ndim == 2:
        print("grayscale BIP conversion path")
        # Grayscale: replicate into R, G, B
        h, w = arr.shape
        alpha = np.ones((h, w), dtype=arr.dtype)
        rgba = np.stack((arr, arr, arr, alpha), axis=-1)  # (H, W, 4)

    elif arr.ndim == 3 and arr.shape[0] == 3:
        print("RGB BIP conversion path")
        # BSQ: (3, H, W) -> split into R, G, B
        r, g, b = arr
        h, w = r.shape
        alpha = np.ones((h, w), dtype=arr.dtype)
        rgba = np.stack((r, g, b, alpha), axis=-1)  # (H, W, 4)

    else:
        raise ValueError(
            f"Expected a 2D array or a 3D BSQ array with shape (3, H, W), got "
            f"{arr.shape}"
        )

    return rgba.reshape(-1)

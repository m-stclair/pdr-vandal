import dataclasses
import json
from typing import Literal, OrderedDict

import multidict
import numpy as np
import pdr
from pyodide.ffi import to_js


def to_js_unproxied(*args, **kwargs):
    """
    Convenience wrapper for pyodide. The important bit is disabling
    Python proxy objects so the JS side gets plain converted values.
    """
    return to_js(*args, **kwargs, create_pyproxies=False)


@dataclasses.dataclass
class PixelCache:
    """
    Very simple size-bounded LRU cache for numpy arrays.

    Keys are tuples describing a loaded product / object / band.
    Values are pixel arrays (either scaled display arrays or masked arrays).

    The cache evicts oldest entries first once total byte usage exceeds
    `max_bytes`.
    """
    max_bytes: int
    _cache: OrderedDict[tuple, np.ndarray] = dataclasses.field(
        default_factory=OrderedDict
    )
    _total: int = 0

    def get(self, key):
        """
        LRU lookup:
        - return None if absent
        - move the entry to the end if present, marking it as recently used
        """
        if key not in self._cache:
            return None
        self._cache.move_to_end(key)
        return self._cache[key]

    def put(self, key, arr: np.ndarray):
        """
        Insert or replace an array in cache.

        Returns False if the single array is too large to cache at all.
        Otherwise stores it, evicts older entries if needed, and returns True.
        """
        if arr.nbytes > self.max_bytes:
            return False
        if key in self._cache:
            self._total -= self._cache[key].nbytes
            del self._cache[key]
        self._cache[key] = arr
        self._total += arr.nbytes
        self._evict()
        return True

    def evict_path(self, path: str):
        """
        Remove every cached entry associated with a particular file path.
        """
        for key in [k for k in self._cache if k[0] == path]:
            self._total -= self._cache.pop(key).nbytes

    def _evict(self):
        """
        Repeatedly evict the least-recently-used item until we're under the
        byte limit or the cache is empty.
        """
        while self._total > self.max_bytes and self._cache:
            _, arr = self._cache.popitem(last=False)
            self._total -= arr.nbytes


PIXEL_CACHE = PixelCache(max_bytes=2 * 1024 ** 3)

# Cache key conventions:
#   (path, objname, band)  -> scaled pixel arrays for one band or RGB triplet
#   (path, objname, None)  -> masked/scaled source array before flattening
CacheKey = tuple[str, str, int | str | None]


@dataclasses.dataclass
class ArrayInfo:
    """
    Lightweight metadata about a renderable array object.
    """
    width: int
    height: int
    bands: int
    json_meta: str


@dataclasses.dataclass
class BandPixels:
    """
    Metadata describing how a particular band (or RGB composite) was scaled.

    `channels` is expected to be:
      - 1 for a flattened single-band array
      - 3 for flattened BIP RGB data suitable for WebGL RGB32F use

    `scale` and `offset` define the original -> normalized transform:
        scaled = (raw - offset) / scale

    Statistical fields are stored in normalized 0-1 space as well.
    """
    channels: int
    scale: float
    offset: float
    mean: float
    std: float
    p02: float
    p98: float


@dataclasses.dataclass
class ArrayObject:
    """
    Representation of a displayable array-bearing object in a product.

    `band_pixels` caches per-band display metadata, not the pixel
    arrays themselves. They are independently stored in, and may be
    independently evicted from, PIXEL_CACHE.
    """
    band_pixels: dict[str | int, BandPixels]
    info: ArrayInfo
    name: str


@dataclasses.dataclass
class DummyObject:
    """
    Placeholder used for product objects that are not renderable arrays.
    """
    pass


@dataclasses.dataclass
class RegistryEntry:
    """
    One loaded product file plus the objects discovered inside it.

    `populated` indicates whether `objects` has been scanned and filled.
    """
    data: pdr.Data
    objects: dict[str, ArrayObject | DummyObject]
    populated: bool = False


DATA_REGISTRY: dict[str, RegistryEntry] = {}


# TODO: this is expensive, but a rare pathological case. might nevertheless
#  want to add a separate cache path to keep this unscaled array 'semi-warm'
#  (assuming it's even renderable, which for products this weird...).
def _just_load_and_check_array_shape(
    data, objname
) -> tuple[dict | None, bool]:
    """
    Fallback path: actually load the array and infer shape from the ndarray
    itself when metadata parsing is missing, broken, or incomplete.

    Returns:
      ({bands, width, height}, True) if the object is a 2-D or 3-D ndarray
      (None, False) otherwise
    """
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


def init_array_object(data: pdr.Data, objname: str) -> ArrayObject | None:
    """
    Try to determine whether `objname` names a renderable array in this product,
    and if so build an ArrayObject with dimensions and metadata.

    This function has a mildly baroque format-dispatch structure because it
    supports several product standards:
      - PDS4
      - FITS
      - PDS3
      - desktop image formats known to PDR
      - generic ndarray fallback

    Returns:
      ArrayObject if the object looks renderable
      None otherwise
    """
    from pdr.loaders.utility import DESKTOP_IMAGE_STANDARDS

    dims, block = {}, None

    if data.standard == 'PDS4' and objname in data._pds4_structures:
        # For PDS4, inspect the declared structure rather than loading pixels.
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
        # use astropy's HDU summary instead of loading full data.
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
                # 1-D arrays, 0-D stubs, and >3-D arrays not supported
                return None
            dims['width'] = dimensions[0]
            dims['height'] = dimensions[1]
    elif data.standard == 'PDS3':
        # PDS3 requires a little more loader gymnastics because object pointers
        # can refer to several different backing representations.
        from pdr.formats.checkers import check_special_block
        from pdr.loaders.datawrap import (
            ReadCompressedImage, ReadImage, ReadFits
        )
        from pdr.loaders.dispatch import pointer_to_loader
        try:
            loader = pointer_to_loader(objname, data)
        except (AttributeError, ValueError):
            # TODO: this is hitting a case where PDR incorrectly thinks a
            #  detached ENVI header might be a FITS header and seizes up.
            #  this should be fixed upstream.
            loader = None
        if not isinstance(loader, (ReadImage, ReadFits, ReadCompressedImage)):
            return None

        is_special, block = check_special_block(
            objname, data, data.identifiers
        )
        ok = True
        if not is_special:
            block = data.metablock_(objname)
        if block is None:
            # No usable block metadata; load and infer shape directly.
            dims, ok = _just_load_and_check_array_shape(data, objname)
        else:
            dims['height'] = block.get('LINES')
            dims['width'] = block.get('LINE_SAMPLES')
            dims['bands'] = block.get('BANDS', 1)
        if any(d is None for d in dims.values()):
            # Metadata existed but was incomplete; fall back to loading.
            dims, ok = _just_load_and_check_array_shape(data, objname)
        if not ok:
            return None
    elif data.standard in DESKTOP_IMAGE_STANDARDS:
        # For ordinary desktop image files, PIL tells us mode and dimensions.
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
            # unknown / odd image mode: fall back to ndarray loading
            dims, ok = _just_load_and_check_array_shape(data, objname)
            if not ok:
                return None
    else:
        # Generic fallback for anything not covered above.
        dims, ok = _just_load_and_check_array_shape(data, objname)
        if not ok:
            return None

    # Prefer per-object metablock where available; otherwise fall back
    # to overall product metadata.
    if block is None:
        meta = (
            dict(data.metablock(objname))
            if data.metablock(objname) is not None
            else dict(data.metadata)
        )
    else:
        meta = block
    info = ArrayInfo(json_meta=to_json_safe(meta), **dims)
    return ArrayObject(info=info, band_pixels={}, name=objname)


def populate_registry_entry(entry: RegistryEntry):
    """
    Scan all objects in a loaded pdr.Data product and classify each one as:
      - ArrayObject if it looks renderable
      - DummyObject otherwise
    """
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
def clear_cache(path, cache=PIXEL_CACHE):
    """
    Keep only the current product alive in the registry, and evict all cache
    entries belonging to the given path.
    """
    other_paths = []
    for p in tuple(DATA_REGISTRY.keys()):
        if p != path:
            other_paths.append(p)
            del DATA_REGISTRY[p]
    for p in other_paths:
        cache.evict_path(p)


@dataclasses.dataclass
class LoadResult:
    """
    Result wrapper for product-loading operations.
    """
    ok: bool
    entry: RegistryEntry | None = None
    error: Exception | None = None


def load_if_required(path: str) -> LoadResult:
    """
    Load a product from disk only if it is not already present in the global
    registry.

    On success:
      - the product is parsed with pdr.read()
      - cache/registry are trimmed via clear_cache()
      - its object inventory is populated
    """
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
    """
    Load an object's scaled data, convert invalid values to a masked array,
    and remove the loaded attribute from the pdr object afterward.

    This produces the "source" array used for later band selection and
    normalization.
    """
    data.load(objname, reload=True)
    arr = data.get_scaled(objname)
    delattr(data, objname)
    arr = np.ma.masked_invalid(arr)
    return arr


def _compute_stats(pixels: np.ndarray) -> dict:
    """
    Compute summary statistics on finite, unmasked pixels only.
    """
    flat = pixels.compressed() if isinstance(pixels, np.ma.MaskedArray) else pixels.ravel()
    flat = flat[np.isfinite(flat)]
    p02, p98 = np.percentile(flat, [2, 98])
    return {
        'mean': float(np.mean(flat)),
        'std': float(np.std(flat)),
        'p02': float(p02),
        'p98': float(p98),
    }


def _scale_and_cache(
    entry: RegistryEntry,
    obj: ArrayObject,
    band: int | Literal["RGB"],
    pixels: np.ndarray,
    raw_stats: dict,
    cache: PixelCache = PIXEL_CACHE
) -> tuple[BandPixels, np.ndarray]:
    """
    Normalize one band (or an RGB 3-band stack) into float32 0-1 display space,
    compute normalized statistics metadata, and cache the flattened pixel array.

    For single-band data:
      - output is a 1-D float32 array

    For RGB:
      - input is expected to be BSQ shaped (3, H, W)
      - output is flattened BIP [r,g,b,r,g,b,...]
    """
    if not isinstance(band, int):
        if not (pixels.ndim == 3 and pixels.shape[0] == 3):
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

    band_key = (entry.data.filename, obj.name, band)
    cache.put(band_key, scaled)

    bandpixels = BandPixels(
        scale=scale,
        offset=offset,
        mean=rescale(raw_stats['mean']),
        std=raw_stats['std'] / scale,
        p02=rescale(raw_stats['p02']),
        p98=rescale(raw_stats['p98']),
        channels=channels
    )
    obj.band_pixels[band] = bandpixels
    return bandpixels, scaled


def _get_or_reload_masked(
    entry: RegistryEntry, objname: str, cache: PixelCache
) -> np.ndarray:
    """
    Return the cached masked/scaled source array for an object if present;
    otherwise reload it and cache it under the `(path, objname, None)` key.
    """
    key = (entry.data.filename, objname, None)
    if (masked := cache.get(key)) is not None:
        return masked
    masked = prep_masked_array(entry.data, objname)
    cache.put(key, masked)
    return masked


def _resolve_band(obj: ArrayObject, band: int | str | None) -> int | Literal["RGB"]:
    """
    Normalize whatever the caller passed into a canonical selection key.

    Rules:
      - single-band objects always resolve to band 0
      - non-integer request on 3- or 4-band data means "RGB"
      - non-integer request on other multi-band data picks the middle band
      - integer request is passed through unchanged

    This normalized value is also used as the cache key component.
    """
    if obj.info.bands == 1:
        return 0
    if not isinstance(band, int) and obj.info.bands in (3, 4):
        return "RGB"
    if not isinstance(band, int):
        return obj.info.bands // 2
    return band


def _arr_for_band(
    masked: np.ndarray, band: int | Literal["RGB"], obj: ArrayObject
) -> np.ndarray:
    """
    Slice the source masked array down to the requested view:

      - RGB request -> first 3 bands
      - single-band object -> the array itself
      - explicit band index -> that band from a band-sequential cube
    """
    if not isinstance(band, int):
        return masked[:3]
    return masked if obj.info.bands == 1 else masked[band]


def _rescale_and_cache(
    entry: RegistryEntry,
    obj: ArrayObject,
    band: int | Literal["RGB"],
    arr: np.ndarray,
    bandpixels: BandPixels,
    cache: PixelCache = PIXEL_CACHE,
) -> tuple[BandPixels, np.ndarray]:
    """
    Rebuild scaled pixels from surviving BandPixels metadata after the pixel
    array itself was evicted from cache.

    This avoids recomputing stats; it just reapplies the known scale/offset.
    """
    scaled = ((arr - bandpixels.offset) / bandpixels.scale).astype('f4')
    if isinstance(scaled, np.ma.MaskedArray):
        scaled[scaled.mask] = np.nan
        scaled = scaled.data
    scaled = bsq_to_bip_1d(scaled) if not isinstance(band, int) else scaled.ravel()
    cache.put((entry.data.filename, obj.name, band), scaled)
    return bandpixels, scaled


def get_scaled_rgba_bip(
    result: LoadResult,
    objname: str,
    band: str | int | None = None,
    cache: PixelCache = PIXEL_CACHE,
) -> tuple[BandPixels, np.ndarray]:
    """
    Main accessor for a display-ready pixel payload.

    Flow:
      1. Validate that the named object exists and is renderable.
      2. Normalize the band selection.
      3. Return cached band pixels if both metadata and scaled array survive.
      4. Otherwise reload the masked source array if needed.
      5. If stats metadata survives, just rescale and recache.
      6. Else compute stats, scale, and cache from scratch.
    """
    entry = result.entry
    if objname not in entry.objects:
        raise ValueError(f"no array named {objname} in {entry.data.filename}")
    obj = entry.objects[objname]
    if isinstance(obj, DummyObject):
        raise TypeError(f"{objname} is not an array")

    band = _resolve_band(obj, band)
    band_key = (entry.data.filename, obj.name, band)
    bandpixels = obj.band_pixels.get(band)
    cached_pixels = cache.get(band_key)

    if bandpixels is not None and cached_pixels is not None:
        return bandpixels, cached_pixels

    masked = _get_or_reload_masked(entry, objname, cache)
    arr = _arr_for_band(masked, band, obj)

    if bandpixels is not None:
        # stats are alive on bandpixels, pixels were just evicted
        return _rescale_and_cache(entry, obj, band, arr, bandpixels, cache)

    raw_stats = _compute_stats(arr)
    return _scale_and_cache(entry, obj, band, arr, raw_stats, cache)


def to_json_safe(meta: dict | multidict.MultiDict):
    """
    Convert nested metadata structures into something JSON-serializable.

    Behavior:
      - MultiDict -> plain dict (repeated keys are discarded)
      - dict/list/tuple -> recurse
      - JSON-native scalars -> pass through
      - everything else -> stringify

    a little inefficient but these structures aren't that large.
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


def get_array_image(
    path: str,
    objname: str | None = None,
    band: str | int | None = None
) -> object:
    """
    Public JS-facing helper to fetch one displayable array payload.

    Returns a JS object with:
      - ok/error status
      - flattened pixel buffer
      - scaling metadata
      - dimensions and channel count
      - summary statistics in normalized space
  """
    try:
        result = load_if_required(path)
        if not result.ok:
            raise ValueError(f"Failed to load {path}: {result.error}")
        bandpixels, arr = get_scaled_rgba_bip(result, objname, band)
        info = result.entry.objects[objname].info
        return to_js_unproxied({
            "ok": True,
            "pixels": arr,
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


def get_product_info(path: str) -> object:
    """
    Public JS-facing helper to return metadata for every renderable array object
    in a product.

    Output shape:
      { ok: True, objects: "<json string>" }
   """
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

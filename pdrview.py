import dataclasses
import json
import os
import re
from typing import Literal, OrderedDict

import multidict
import numpy as np
import pdr
from pyodide import ffi as _ffi
from pyodide.ffi import to_js

# A JS null argument arrives in Python as pyodide.ffi.jsnull (Pyodide 0.28+),
# not None; only undefined becomes None.
jsnull = getattr(_ffi, "jsnull", None)


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

    def flush(self):
        while len(self._cache) > 0:
            self._cache.popitem()

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
#   (path, objname, band, geometry) -> scaled pixel arrays for one band or RGB
#                                      triplet after a Geometry transform
#   (path, objname, None)           -> masked/scaled source array before
#                                      band selection and flattening
CacheKey = tuple


@dataclasses.dataclass(frozen=True)
class Geometry:
    """
    Lossless or value-preserving array geometry applied to a band (or RGB
    stack) before scaling, in this order:
      1. crop to columns x0:x0+width, rows y0:y0+height (original pixels;
         row 0 is the first row pdr returns)
      2. rebin by integer factor `bin`: mean of each bin x bin block,
         ignoring masked / non-finite pixels; a block with no valid pixels
         is masked. A partial block at the right / bottom edge is dropped.
      3. flip left-right, if `flip`
      4. rotate `rot` quarter turns clockwise (as displayed)
    Statistics and scale / offset are computed on the result, so every
    clip mode works on the transformed array.

    Frozen (hashable) so it can be part of cache keys. width / height of
    None mean "to the edge".
    """
    x0: int = 0
    y0: int = 0
    width: int | None = None
    height: int | None = None
    bin: int = 1
    flip: bool = False
    rot: int = 0

    def resolved(self, h: int, w: int) -> "Geometry":
        """Clamp the crop box to an h x w array and fill in to-the-edge
        sizes, so equivalent requests share one cache key."""
        x0 = min(max(int(self.x0), 0), w - 1)
        y0 = min(max(int(self.y0), 0), h - 1)
        cw = w - x0 if self.width is None else min(max(int(self.width), 1), w - x0)
        ch = h - y0 if self.height is None else min(max(int(self.height), 1), h - y0)
        b = max(int(self.bin), 1)
        b = min(b, cw, ch)
        return Geometry(x0, y0, cw, ch, b, bool(self.flip), int(self.rot) % 4)

    @property
    def is_identity(self) -> bool:
        return self.bin == 1 and not self.flip and self.rot == 0

    def output_shape(self) -> tuple[int, int]:
        """(height, width) of the result; requires a resolved Geometry."""
        h, w = self.height // self.bin, self.width // self.bin
        return (w, h) if self.rot % 2 else (h, w)


def parse_geometry(spec) -> Geometry | None:
    """
    Geometry from a JSON string or dict with any of the Geometry fields;
    None / JS null / "" / "null" mean no transform.
    """
    if spec is None or (jsnull is not None and spec is jsnull):
        return None
    if isinstance(spec, str):
        if spec.strip() in ("", "null"):
            return None
        spec = json.loads(spec)
    if not isinstance(spec, dict):
        raise TypeError(f"geometry must be an object, not {type(spec).__name__}")
    fields = {f.name for f in dataclasses.fields(Geometry)}
    unknown = set(spec) - fields
    if unknown:
        raise ValueError(f"unknown geometry fields: {sorted(unknown)}")
    return Geometry(**{k: v for k, v in spec.items() if v is not None})


def rebin_mean(arr: np.ndarray, b: int) -> np.ma.MaskedArray:
    """
    Mean over b x b blocks of the last two axes, ignoring masked and
    non-finite pixels. Trailing rows / columns that don't fill a block are
    dropped. A block with no valid pixels is masked.
    """
    if b == 1:
        return np.ma.masked_invalid(arr)
    h, w = arr.shape[-2] // b * b, arr.shape[-1] // b * b
    arr = np.ma.masked_invalid(arr[..., :h, :w])
    lead = arr.shape[:-2]
    blocks = arr.reshape(*lead, h // b, b, w // b, b)
    # float64 accumulation: block sums of float32 data lose precision
    return blocks.astype('f8').mean(axis=(-3, -1))


def apply_geometry(arr: np.ndarray, geom: Geometry | None) -> np.ndarray:
    """
    Apply a resolved Geometry to a (H, W) or (bands, H, W) array, which may
    be masked. See Geometry for the order of operations.
    """
    if geom is None:
        return arr
    out = arr[..., geom.y0:geom.y0 + geom.height, geom.x0:geom.x0 + geom.width]
    if geom.bin > 1:
        out = rebin_mean(out, geom.bin)
    if geom.flip:
        out = out[..., :, ::-1]
    if geom.rot:
        # np.rot90 turns counterclockwise from axis -2 toward -1, so a
        # negative k is clockwise as displayed (row 0 at the top)
        out = np.rot90(out, -geom.rot, axes=(-2, -1))
    return out


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
    zmin: float
    zmax: float
    # dimensions of the (possibly Geometry-transformed) array
    height: int = 0
    width: int = 0


@dataclasses.dataclass
class ArrayObject:
    """
    Representation of a displayable array-bearing object in a product.

    `band_pixels` caches per-(band, geometry) display metadata, not the pixel
    arrays themselves. They are independently stored in, and may be
    independently evicted from, PIXEL_CACHE.
    """
    band_pixels: dict[tuple, BandPixels]
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
        if not ok:
            return None
        if any(d is None for d in dims.values()):
            # Metadata existed but was incomplete; fall back to loading.
            dims, ok = _just_load_and_check_array_shape(data, objname)
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


# ---------------------------------------------------------------------------
# zscale_limits() is vendored from astropy, to avoid depending on astropy:
#   astropy.visualization.ZScaleInterval.get_limits (astropy 8.0.3)
#   https://github.com/astropy/astropy/blob/main/astropy/visualization/interval.py
# Astropy's implementation is in turn based on IRAF's zscale, as implemented
# in stsci.numdisplay:
#   https://github.com/spacetelescope/stsci.numdisplay/blob/master/lib/stsci/numdisplay/zscale.py
#
# Modifications from astropy's version: the ZScaleInterval class and its
# get_limits() method are flattened into a single function taking the same
# parameters as keyword arguments; BaseInterval._process_values() is inlined
# (masked/non-finite values are dropped); the result is returned as Python
# floats. The algorithm itself is unchanged.
#
# The astropy and AURA licenses are reproduced below, as both require.
#
# ----- astropy LICENSE.rst -----
# Copyright (c) 2011-2026, Astropy Developers
#
# All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
# * Redistributions of source code must retain the above copyright notice,
#   this list of conditions and the following disclaimer.
# * Redistributions in binary form must reproduce the above copyright notice,
#   this list of conditions and the following disclaimer in the documentation
#   and/or other materials provided with the distribution.
# * Neither the name of the Astropy Team nor the names of its contributors may
#   be used to endorse or promote products derived from this software without
#   specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
# AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
# IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
# ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
# LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
# CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
# SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
# INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
# CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
# ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
# POSSIBILITY OF SUCH DAMAGE.
#
# ----- astropy licenses/AURA_LICENSE.rst -----
# Copyright (C) 2005 Association of Universities for Research in Astronomy
# (AURA)
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
#     1. Redistributions of source code must retain the above copyright
#       notice, this list of conditions and the following disclaimer.
#
#     2. Redistributions in binary form must reproduce the above
#       copyright notice, this list of conditions and the following
#       disclaimer in the documentation and/or other materials provided
#       with the distribution.
#
#     3. The name of AURA and its representatives may not be used to
#       endorse or promote products derived from this software without
#       specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY AURA ``AS IS'' AND ANY EXPRESS OR IMPLIED
# WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
# DISCLAIMED. IN NO EVENT SHALL AURA BE LIABLE FOR ANY DIRECT, INDIRECT,
# INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
# BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
# OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
# ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
# TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
# USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
# DAMAGE.
# ---------------------------------------------------------------------------
def zscale_limits(
    values,
    n_samples: int = 1000,
    contrast: float = 0.25,
    max_reject: float = 0.5,
    min_npixels: int = 5,
    krej: float = 2.5,
    max_iterations: int = 5,
) -> tuple[float, float]:
    """
    Return (vmin, vmax) display limits using IRAF's zscale algorithm.

    Vendored from astropy's `ZScaleInterval.get_limits` (see the credit and
    license notice above); parameters have the same meaning and defaults:

    n_samples : number of points sampled from the array.
    contrast : scaling factor (0-1); larger values narrow the interval.
    max_reject : if more than max_reject * npixels pixels are rejected,
        return the min and max of the samples.
    min_npixels : if fewer than this many pixels remain after rejection,
        return the min and max of the samples.
    krej : number of sigma used for rejection.
    max_iterations : maximum number of rejection iterations.

    Masked and non-finite values are ignored.
    """
    # Inlined from astropy's BaseInterval._process_values. Boolean indexing
    # returns a copy, so the in-place sort below never touches the caller's
    # array.
    data = np.ma.getdata(values)
    mask = np.ma.getmask(values)
    ok = np.isfinite(data)
    if mask is not np.ma.nomask:
        ok &= ~mask
    values = data[ok]

    # Sample the image
    stride = int(max(1.0, values.size / n_samples))
    samples = values[::stride][:n_samples]
    samples.sort()

    npix = len(samples)
    vmin = samples[0]
    vmax = samples[-1]

    # Fit a line to the sorted array of samples
    minpix = max(min_npixels, int(npix * max_reject))
    x = np.arange(npix)
    ngoodpix = npix
    last_ngoodpix = npix + 1

    # Bad pixels mask used in k-sigma clipping
    badpix = np.zeros(npix, dtype=bool)

    # Kernel used to dilate the bad pixels mask
    ngrow = max(1, int(npix * 0.01))
    kernel = np.ones(ngrow, dtype=bool)

    for _ in range(max_iterations):
        if ngoodpix >= last_ngoodpix or ngoodpix < minpix:
            break

        fit = np.polyfit(x, samples, deg=1, w=(~badpix).astype(int))
        fitted = np.poly1d(fit)(x)

        # Subtract fitted line from the data array
        flat = samples - fitted

        # Compute the k-sigma rejection threshold
        threshold = krej * flat[~badpix].std()

        # Detect and reject pixels further than k*sigma from the
        # fitted line
        badpix[(flat < -threshold) | (flat > threshold)] = True

        # Convolve with a kernel of length ngrow
        badpix = np.convolve(badpix, kernel, mode="same")

        last_ngoodpix = ngoodpix
        ngoodpix = np.sum(~badpix)

    if ngoodpix >= minpix:
        slope, _ = fit

        if contrast > 0:
            slope = slope / contrast
        center_pixel = (npix - 1) // 2
        median = np.median(samples)
        vmin = max(vmin, median - (center_pixel - 1) * slope)
        vmax = min(vmax, median + (npix - center_pixel) * slope)

    return float(vmin), float(vmax)


def _compute_stats(pixels: np.ndarray) -> dict:
    """
    Compute summary statistics on finite, unmasked pixels only.
    """
    flat = pixels.compressed() if isinstance(pixels, np.ma.MaskedArray) else pixels.ravel()
    flat = flat[np.isfinite(flat)]
    p02, p98 = np.percentile(flat, [2, 98])
    zmin, zmax = zscale_limits(flat)
    return {
        'mean': float(np.mean(flat)),
        'std': float(np.std(flat)),
        'p02': float(p02),
        'p98': float(p98),
        'zmin': zmin,
        'zmax': zmax,
    }


def _scale_and_cache(
    entry: RegistryEntry,
    obj: ArrayObject,
    band: int | Literal["RGB"],
    pixels: np.ndarray,
    raw_stats: dict,
    cache: PixelCache = PIXEL_CACHE,
    geom: Geometry | None = None,
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

    band_key = (entry.data.filename, obj.name, band, geom)
    cache.put(band_key, scaled)

    bandpixels = BandPixels(
        scale=scale,
        offset=offset,
        mean=rescale(raw_stats['mean']),
        std=raw_stats['std'] / scale,
        p02=rescale(raw_stats['p02']),
        p98=rescale(raw_stats['p98']),
        zmin=rescale(raw_stats['zmin']),
        zmax=rescale(raw_stats['zmax']),
        channels=channels,
        height=int(pixels.shape[-2]),
        width=int(pixels.shape[-1]),
    )
    obj.band_pixels[(band, geom)] = bandpixels
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
    geom: Geometry | None = None,
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
    cache.put((entry.data.filename, obj.name, band, geom), scaled)
    return bandpixels, scaled


def _resolve_geometry(obj: ArrayObject, geometry: Geometry | None) -> Geometry | None:
    """
    Canonical form of a requested Geometry for an object, used as the cache
    key component: clamped to the object's dimensions, or None when it
    changes nothing (so it shares the untransformed cache entries).
    """
    if geometry is None:
        return None
    geom = geometry.resolved(obj.info.height, obj.info.width)
    if geom == Geometry(0, 0, obj.info.width, obj.info.height):
        return None
    return geom


def get_scaled_rgba_bip(
    result: LoadResult,
    objname: str,
    band: str | int | None = None,
    cache: PixelCache = PIXEL_CACHE,
    geometry: Geometry | None = None,
) -> tuple[BandPixels, np.ndarray]:
    """
    Main accessor for a display-ready pixel payload, optionally after a
    Geometry transform (crop / rebin / flip / rotate).

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
    geom = _resolve_geometry(obj, geometry)
    band_key = (entry.data.filename, obj.name, band, geom)
    bandpixels = obj.band_pixels.get((band, geom))
    cached_pixels = cache.get(band_key)

    if bandpixels is not None and cached_pixels is not None:
        return bandpixels, cached_pixels

    masked = _get_or_reload_masked(entry, objname, cache)
    arr = apply_geometry(_arr_for_band(masked, band, obj), geom)

    if bandpixels is not None:
        # stats are alive on bandpixels, pixels were just evicted
        return _rescale_and_cache(entry, obj, band, arr, bandpixels, cache, geom)

    raw_stats = _compute_stats(arr)
    return _scale_and_cache(entry, obj, band, arr, raw_stats, cache, geom)


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
    band: str | int | None = None,
    geometry: str | None = None,
) -> object:
    """
    Public JS-facing helper to fetch one displayable array payload.

    Returns a JS object with:
      - ok/error status
      - flattened pixel buffer
      - scaling metadata
      - dimensions and channel count
      - summary statistics in normalized space
      - the resolved geometry actually applied, as a JSON string (null
        for none)

    `geometry` is an optional JSON string of Geometry fields.
   """
    try:
        result = load_if_required(path)
        if not result.ok:
            raise ValueError(f"Failed to load {path}: {result.error}")
        geometry = parse_geometry(geometry)
        bandpixels, arr = get_scaled_rgba_bip(
            result, objname, band, geometry=geometry
        )
        obj = result.entry.objects[objname]
        geom = _resolve_geometry(obj, geometry)
        return to_js_unproxied({
            "ok": True,
            "pixels": arr,
            "scale": float(bandpixels.scale),
            "offset": float(bandpixels.offset),
            "width": int(bandpixels.width),
            "height": int(bandpixels.height),
            # JSON string (or null), like get_product_info's objects
            "geometry": None if geom is None else json.dumps(dataclasses.asdict(geom)),
            "channels": int(bandpixels.channels),
            "mean": float(bandpixels.mean),
            "std": float(bandpixels.std),
            "p02": float(bandpixels.p02),
            "p98": float(bandpixels.p98),
            "zmin": float(bandpixels.zmin),
            "zmax": float(bandpixels.zmax),
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


def _label_tag(tag: str, nsmap: dict) -> str:
    """Turn an ElementTree '{uri}name' tag into 'prefix:name'."""
    if not tag.startswith("{"):
        return tag
    uri, name = tag[1:].split("}", 1)
    prefix = nsmap.get(uri, "")
    return f"{prefix}:{name}" if prefix else name


def label_to_tree(element, nsmap: dict) -> dict:
    """
    Convert a parsed PDS4 label element (from pdr's Label) into nested
    {key, value?, unit?, children?} nodes. Unlike data.metadata, this keeps
    repeated keys, document order, and the `unit` attribute.
    """
    node = {"key": _label_tag(element.tag, nsmap)}
    children = [label_to_tree(c, nsmap) for c in element if isinstance(c.tag, str)]
    if children:
        node["children"] = children
        return node
    text = (element.text or "").strip()
    if text:
        node["value"] = text
    unit = element.attrib.get("unit")
    if unit:
        node["unit"] = unit
    return node


def _pvl_leaf(value) -> tuple[str, str | None]:
    """Format a PDS3 leaf value as (text, unit). Quantities are
    {'value', 'units'} dicts; tuples of them share a unit when possible."""
    if isinstance(value, dict) and "value" in value:
        return str(value["value"]), value.get("units")
    if isinstance(value, (tuple, list)):
        parts = [_pvl_leaf(v) for v in value]
        units = {u for _, u in parts if u}
        if len(units) == 1 and all(u for _, u in parts):
            return "(" + ", ".join(t for t, _ in parts) + ")", units.pop()
        return "(" + ", ".join(
            f"{t} {u}" if u else t for t, u in parts
        ) + ")", None
    return str(value), None


def _leaf_node(key: str, value) -> dict:
    text, unit = _pvl_leaf(value)
    node = {"key": key, "value": text}
    if unit:
        node["unit"] = unit
    return node


def pds3_to_tree(block, key: str) -> dict:
    """
    Convert a PDS3 label block (a MultiDict from pdr) into nested
    {key, value?, unit?, children?} nodes, keeping duplicates and order.
    A `K_NAME` array next to an equal-length `K` array is shown as one
    group `K` with a child per element, keyed by name.
    """
    paired = {
        k[:-5] for k, v in block.items()
        if k.endswith("_NAME") and isinstance(v, (tuple, list))
        and isinstance(block.get(k[:-5]), (tuple, list))
        and len(block[k[:-5]]) == len(v)
    }
    children = []
    for k, v in block.items():
        if k.endswith("_NAME") and k[:-5] in paired:
            continue
        if isinstance(v, multidict.MultiDict):
            children.append(pds3_to_tree(v, k))
        elif k in paired:
            names = block[k + "_NAME"]
            children.append({
                "key": k,
                "children": [_leaf_node(str(n), x) for n, x in zip(names, v)],
            })
        else:
            children.append(_leaf_node(k, v))
    return {"key": key, "children": children}


# --- Label / header sections for the metadata pane ---------------------------
# A product can carry several labels and headers: a PDS4 or PDS3 label, an
# embedded VICAR header, FITS headers in its data file, TIFF tags, ... Each
# becomes one section {kind, title, tree, raw, error} for the pane; a section
# that fails to parse keeps its error (and its raw text, when that was
# readable) instead of hiding the others. A {note} entry is an aside for the
# pane, not a section.

# Data files a label points to that get sniffed for embedded headers.
LABEL_FILE_SNIFF_LIMIT = 20
# Byte values longer than this (TIFF MakerNote, ICC profiles) are elided.
ELIDE_BYTES_OVER = 256
# Refuse VICAR label sizes beyond this; a corrupt LBLSIZE shouldn't make us
# read the whole file.
VICAR_MAX_LABEL_BYTES = 8 * 1024 * 1024


def _section(kind, title, tree=None, raw=None, error=None) -> dict:
    return {"kind": kind, "title": title, "tree": tree, "raw": raw, "error": error}


def _error_text(e: Exception) -> str:
    return f"{type(e).__name__}: {e}"


def _clean_raw(text: str) -> str:
    """Normalize line ends, drop trailing blanks and NUL padding."""
    text = text.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(line.rstrip() for line in text.split("\n")).strip("\n") + "\n"


def _scalar_text(value) -> str:
    if isinstance(value, (bytes, bytearray)):
        if len(value) > ELIDE_BYTES_OVER:
            return f"<{len(value)} bytes>"
        text = bytes(value).decode("latin-1")
        if all(c.isprintable() or c in "\t\n" for c in text.rstrip("\x00")):
            return text.rstrip("\x00")
        return bytes(value).hex(" ")
    if isinstance(value, (tuple, list)):
        return "(" + ", ".join(_scalar_text(v) for v in value) + ")"
    if isinstance(value, np.generic):
        return str(value.item())
    return str(value)


def mapping_to_tree(key: str, mapping, skip=()) -> dict:
    """Generic nested mapping (e.g. PIL image info / tags) -> pane tree."""
    children = []
    for k, v in mapping.items():
        if k in skip:
            continue
        if hasattr(v, "items") and callable(v.items):
            children.append(mapping_to_tree(str(k), v))
        else:
            children.append({"key": str(k), "value": _scalar_text(v)})
    return {"key": key, "children": children}


# --- FITS ---

def _fits_card_node(card) -> dict | None:
    try:
        key, value, comment = card.keyword, card.value, card.comment
    except Exception:
        # astropy refuses some illegal cards; show them verbatim
        return {"key": card.keyword or "?", "value": card.image.rstrip(),
                "comment": "unparseable card"}
    if not key and not str(value).strip():
        return None   # blank padding card
    if isinstance(value, bool):
        text = "T" if value else "F"
    elif type(value).__name__ == "Undefined":
        text = ""
    else:
        text = str(value)
    node = {"key": key or "(blank)", "value": text}
    if comment:
        node["comment"] = str(comment)
    return node


def fits_section(hdulist, title: str) -> dict:
    """All HDU headers of an open astropy HDUList as one FITS section."""
    children, raws = [], []
    for i, hdu in enumerate(hdulist):
        header = hdu.header
        name = f"HDU {i}" + (f" ({hdu.name})" if hdu.name else "")
        cards = [n for n in (_fits_card_node(c) for c in header.cards) if n]
        children.append({"key": name, "children": cards})
        try:
            text = header.tostring(sep="\n", endcard=True, padding=False)
        except Exception as e:
            text = f"(header text unavailable: {_error_text(e)})"
        raws.append(f"--- {name} ---\n" + text.rstrip())
    return _section("FITS", title, {"key": title, "children": children},
                    _clean_raw("\n".join(raws)))


def _fits_file_section(path: str, title: str) -> dict:
    from astropy.io import fits

    with fits.open(path, lazy_load_hdus=True, ignore_missing_simple=True) as hdulist:
        return fits_section(hdulist, title)


# --- VICAR ---

_VICAR_ITEM = re.compile(
    r"([A-Za-z0-9_]+)\s*=\s*"
    r"('(?:[^']|'')*'"                              # 'quoted, '' escapes'
    r"|\((?:[^()']|'(?:[^']|'')*')*\)"              # (a, 'b', c)
    r"|[^\s']+)"                                    # bare number / word
)
_VICAR_LIST_ITEM = re.compile(r"'(?:[^']|'')*'|[^,\s]+")


def _vicar_value(text: str) -> str:
    text = text.strip()
    if text.startswith("'"):
        return text[1:-1].replace("''", "'")
    if text.startswith("("):
        return "(" + ", ".join(
            _vicar_value(v) for v in _VICAR_LIST_ITEM.findall(text[1:-1])
        ) + ")"
    return text


def parse_vicar_text(text: str):
    """
    Parse VICAR label text into pane groups and display lines.
    Items before the first PROPERTY / TASK are the system label; each
    PROPERTY='X' and TASK='Y' item starts a group of its own.
    Returns (groups, items, lines): groups are pane tree nodes, `items` the
    system label as {KEY: value text}, `lines` the raw text one item a line.
    """
    text = text.replace("\x00", " ")
    groups = [{"key": "System", "children": []}]
    system, lines = {}, []
    matched = 0
    for m in _VICAR_ITEM.finditer(text):
        key, raw_value = m.group(1), m.group(2)
        value = _vicar_value(raw_value)
        if key in ("PROPERTY", "TASK"):
            groups.append({"key": f"{key} {value}", "children": []})
            lines.append("")
        elif len(groups) == 1:
            system.setdefault(key, value)
        groups[-1]["children"].append({"key": key, "value": value})
        lines.append(f"{key}={raw_value}")
        matched += 1
    if not matched or groups[0]["children"][:1] == [] or \
            groups[0]["children"][0]["key"] != "LBLSIZE":
        raise ValueError("not a VICAR label (no leading LBLSIZE item)")
    return groups, system, lines


def _read_vicar_label(f, offset: int) -> str:
    f.seek(offset)
    head = f.read(64).decode("latin-1")
    m = re.match(r"\s*LBLSIZE\s*=\s*(\d+)", head)
    if not m:
        raise ValueError(f"no LBLSIZE at byte {offset}")
    size = int(m.group(1))
    if not 0 < size <= VICAR_MAX_LABEL_BYTES:
        raise ValueError(f"implausible LBLSIZE {size}")
    f.seek(offset)
    return f.read(size).decode("latin-1")


def vicar_section(path: str, title: str, offset: int = 0) -> dict:
    """The VICAR label at `offset` in `path`, plus its end-of-file label."""
    raw = None
    try:
        with open(path, "rb") as f:
            text = _read_vicar_label(f, offset)
            raw = text
            groups, system, lines = parse_vicar_text(text)
            if system.get("EOL", "0").strip() == "1":
                as_int = lambda k: int(system.get(k, "0"))
                eol_at = (offset + as_int("LBLSIZE")
                          + (as_int("NLB") + as_int("N2") * as_int("N3")) * as_int("RECSIZE"))
                eol_text = _read_vicar_label(f, eol_at)
                eol_groups, _, eol_lines = parse_vicar_text(eol_text)
                for g in eol_groups:
                    g["key"] = f"EOL {g['key']}"
                groups += eol_groups
                lines += ["", "--- EOL label ---"] + eol_lines
        return _section("VICAR", title, {"key": title, "children": groups},
                        _clean_raw("\n".join(lines)))
    except Exception as e:
        return _section("VICAR", title, raw=_clean_raw(raw) if raw else None,
                        error=_error_text(e))


# --- PDS3 / PDS4 ---

def _pds3_raw(labelname: str) -> str:
    from pdr.parselabel.pds3 import trim_label

    return _clean_raw(trim_label(labelname, strict_decode=False, raise_no_ending=True))


def _pds3_section(metadata, labelname: str, title: str) -> dict | None:
    """A PDS3 label section, or None when the file has no PVL label at all."""
    raw = error = tree = None
    try:
        raw = _pds3_raw(labelname)
    except Exception as e:
        error = e
    if not len(metadata):
        return None   # nothing parsed: not a PDS3 product (e.g. plain text)
    try:
        tree = pds3_to_tree(metadata, title)
    except Exception as e:
        error = e
    return _section("PDS3", title, tree, raw,
                    _error_text(error) if error and tree is None else None)


def _pds4_section(data) -> dict:
    title = os.path.basename(data.labelname)
    raw = tree = None
    try:
        with open(data.labelname, encoding="utf-8", errors="replace") as f:
            raw = f.read()
        label = data.label
        tree = label_to_tree(label.getroot(), label.get_namespace_map())
        return _section("PDS4", title, tree, raw)
    except Exception as e:
        return _section("PDS4", title, tree, raw, _error_text(e))


# --- the product's files ---

def _resolve_in_dir(directory: str, name: str) -> str | None:
    """`name` in `directory`, matched case-insensitively (PDS3 pointers often
    differ in case from the delivered filenames)."""
    exact = os.path.join(directory, name)
    if os.path.exists(exact):
        return exact
    try:
        for entry in os.listdir(directory or "."):
            if entry.lower() == name.lower():
                return os.path.join(directory, entry)
    except OSError:
        pass
    return None


def _product_files(data) -> list[str]:
    """Data files the product's label names, other than the label itself."""
    labelname = data.labelname or data.filename
    directory = os.path.dirname(labelname)
    names = []
    if data.standard == "PDS4":
        for el in data.label.getroot().iter():
            if isinstance(el.tag, str) and el.tag.rsplit("}", 1)[-1] == "file_name" and el.text:
                names.append(el.text.strip())
    elif data.standard == "PDS3":
        for key, value in data.metadata.items():
            if not str(key).startswith("^"):
                continue
            target = value[0] if isinstance(value, (tuple, list)) and value else value
            if isinstance(target, str):
                names.append(target)
    files = []
    for name in names:
        path = _resolve_in_dir(directory, os.path.basename(name))
        if path and os.path.abspath(path) != os.path.abspath(labelname) and path not in files:
            files.append(path)
    if data.filename and os.path.abspath(data.filename) != os.path.abspath(labelname) \
            and data.filename not in files:
        files.insert(0, data.filename)
    return files


def _sniff_file(path: str, primary: str) -> dict | None:
    """A section for the header a data file starts with, or None."""
    with open(path, "rb") as f:
        head = f.read(16)
    name = os.path.basename(path)
    try:
        if head.startswith(b"LBLSIZE="):
            return vicar_section(path, f"header in {name}")
        if head.startswith(b"SIMPLE  ="):
            return _fits_file_section(path, name)
        if head[:4] in (b"II*\x00", b"MM\x00*"):
            from pdr.pil_utils import skim_image_data

            return _section("TIFF", name, mapping_to_tree(name, skim_image_data(path), skip=("fn",)))
        if primary == "PDS4" and head.startswith((b"PDS_VERSION_ID", b"ODL_VERSION_ID")):
            from pdr.parselabel.pds3 import read_pvl
            from pdr.pdr import Metadata

            return _pds3_section(Metadata(read_pvl(path)), path, f"label in {name}")
    except Exception as e:
        kind = ("VICAR" if head.startswith(b"LBLSIZE=") else "FITS" if head.startswith(b"SIMPLE")
                else "TIFF" if head[:2] in (b"II", b"MM") else "PDS3")
        return _section(kind, name, error=_error_text(e))
    return None


def _pds3_vicar_headers(data) -> tuple[list[dict], set[str]]:
    """VICAR headers a PDS3 label declares as *_HEADER objects, and the files
    they were read from (so file sniffing doesn't show them again)."""
    out, files = [], set()
    for key, block in data.metadata.items():
        if not (str(key).endswith("HEADER") and hasattr(block, "get")):
            continue
        if "VICAR" not in str(block.get("HEADER_TYPE", "")).upper():
            continue
        title = f"{key} in {os.path.basename(data.labelname)}"
        try:
            text = data[key]
            if key in data.file_mapping:
                files.add(os.path.abspath(data.file_mapping[key]))
            if not isinstance(text, str):
                raise ValueError(f"pdr read {key} as {type(text).__name__}, not text")
            groups, _, lines = parse_vicar_text(text)
            out.append(_section("VICAR", title, {"key": title, "children": groups},
                                _clean_raw("\n".join(lines))))
        except Exception as e:
            out.append(_section("VICAR", title, error=_error_text(e)))
    return out, files


def label_sections(data) -> list[dict]:
    """Every label / header section of a loaded pdr Data object."""
    sections = []
    vicar_files = set()
    standard = data.standard
    if standard == "PDS4":
        sections.append(_pds4_section(data))
    elif standard == "PDS3":
        section = _pds3_section(data.metadata, data.labelname, os.path.basename(data.labelname))
        if section:
            sections.append(section)
            headers, vicar_files = _pds3_vicar_headers(data)
            sections += headers
    elif standard == "FITS":
        try:
            sections.append(fits_section(data._hdulist, os.path.basename(data.filename)))
        except Exception as e:
            sections.append(_section("FITS", os.path.basename(data.filename), error=_error_text(e)))
    else:
        # desktop image formats (TIFF, JPEG, PNG, ...): pdr's PIL metadata
        name = os.path.basename(data.filename)
        try:
            sections.append(_section(str(standard), name,
                                     mapping_to_tree(name, data.metadata, skip=("fn",))))
        except Exception as e:
            sections.append(_section(str(standard), name, error=_error_text(e)))
        return sections
    if standard in ("PDS3", "PDS4") and sections:
        files = _product_files(data)
        for path in files[:LABEL_FILE_SNIFF_LIMIT]:
            if os.path.abspath(path) in vicar_files:
                continue   # its VICAR header is already a section
            try:
                section = _sniff_file(path, standard)
            except OSError:
                continue   # missing / unreadable data file: nothing to show
            if section:
                sections.append(section)
        if len(files) > LABEL_FILE_SNIFF_LIMIT:
            n = len(files) - LABEL_FILE_SNIFF_LIMIT
            sections.append({"note": (
                f"{n} more data file{'s' if n > 1 else ''} not inspected for headers."
            )})
    return sections


def get_product_label(path: str) -> object:
    """
    Public JS-facing helper: every label / header section of a product, for
    the metadata pane.

    Output shape:
      { ok: True, sections: "<json list of {kind, title, tree, raw, error}>" }
    An empty list means the product has no label or header to show.
    """
    try:
        result = load_if_required(path)
        if not result.ok:
            raise result.error
        sections = label_sections(result.entry.data)
        return to_js_unproxied({"ok": True, "sections": json.dumps(sections)})
    except Exception as e:
        return to_js_unproxied({"ok": False, "error": _error_text(e)})


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


def flush_cache(cache=PIXEL_CACHE):
    try:
        cache.flush()
        for k in tuple(DATA_REGISTRY.keys()):
            DATA_REGISTRY.pop(k)
        return to_js_unproxied({"ok": True, "error": None})
    except Exception as e:
        return to_js_unproxied({
            "ok": False, "error": f"{type(e).__name__}: {e}"
        })

"""
Reference implementation of marslab's decorrelation stretch, vendored for
tests: decorrelation_stretch() from marslab/imgops/render.py and the helpers
it uses from marslab/imgops/imgutils.py, copied verbatim (extracted by AST,
no edits) from marslab 0.9.28 (https://github.com/MillionConcepts/marslab).

Pinned on purpose: the app is tested against this exact behavior. Update it
deliberately, by re-extracting from a new marslab release.

marslab license (BSD 3-Clause):

Copyright (c) 2021, Million Concepts
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
"""
from functools import reduce, partial
from numbers import Real
from typing import Sequence, Optional, Union, Callable, Any
from collections.abc import Sequence
import numpy as np

def decorrelation_stretch(
    channels: Sequence[np.ndarray],
    flat_mask: Optional[np.ndarray] = None,
    contrast_stretch: Optional[Union[Sequence[float], float]] = None,
    sigma: Optional[float] = 1,
    mask_fill_tone: Optional[Union[float, tuple[float, float, float]]] = None,
) -> np.ndarray:
    """
    decorrelation stretch of passed array on last axis of array. see
    Gillespie et al. 1986, etc., etc.

    This is partly an adaptation of the MATLAB DCS implementation.
    Work towards this adaptation is partly due to Lukáš Brabec
    (github.com/lbrabec/decorrstretch) and Christian Tate (unreleased).

    channels: must be at least two ndarrays, numeric dtypes. each ndarray
    should be 2D (size > 1). no infs or nans. no channel may have entirely
    equal elements. extremely large variation in array means between channels
    relative to data type may result in errors.
    integer arrays will be cast to float32. float arrays of depth < 32 will
    be cast to float32.
    contrast_stretch: float or sequence of two floats. each must be
    between 0 and 100 inclusive. percentile ranges to use as max/min bounds
    of output array.
    sigma: fixed target standard deviation for each channel. must be >= 0;
    ranges between 0 and 1 recommended. None means that the original standard
    deviation per channel is used as the target (this is a 'classic'
    decorrelation stretch). Doesn't matter if you're applying a contrast
    stretch.
    """
    if any(isinstance(c, np.ma.MaskedArray) for c in channels):
        working_array = np.ma.dstack(channels)
    else:
        working_array = np.dstack(channels)
    if flat_mask is not None:
        flat_mask = np.dstack([flat_mask] * 3)
        if not isinstance(working_array, np.ma.MaskedArray):
            working_array = np.ma.masked_array(working_array, mask=flat_mask)
        else:
            working_array.mask += flat_mask
    input_shape = working_array.shape
    channel_vectors = working_array.reshape(-1, input_shape[-1])
    if channel_vectors.dtype not in [np.float32, np.float64]:
        working_dtype = np.float32
    else:
        working_dtype = channel_vectors.dtype
    if (
        isinstance(channel_vectors, np.ma.MaskedArray)
        and (cmask := channel_vectors.mask).size > 1
    ):
        selector = cmask[:, 0] | cmask[:, 1] | cmask[:, 2]
        valid_vectors = channel_vectors[~selector]
    else:
        valid_vectors = channel_vectors
    channel_covariance = np.ma.cov(valid_vectors.T).astype(working_dtype)
    eigenvalues, eigenvectors = np.linalg.eig(channel_covariance)
    # diagonal matrix containing per-band "stretch factors"
    stretch_matrix = np.diag(1 / np.sqrt(eigenvalues))
    # mean values for each channel
    channel_means = np.mean(valid_vectors, axis=0, dtype=working_dtype)
    # full transformation matrix:
    # rotates into eigenspace of covariance matrix, applies stretch,
    # rotates back to channelspace, applies sigma scaling
    transformation_matrix = reduce(
        np.dot, [eigenvectors, stretch_matrix, eigenvectors.T]
    )
    # target per-channel standard deviation as a diagonalized matrix.
    # set equal to sigma if sigma is passed; otherwise simply set
    # equal to per-channel input standard deviation. if it's 1, skip the step.
    if sigma is None:
        channel_sigmas = np.diag(np.sqrt(channel_covariance.diagonal()))
        transformation_matrix = np.dot(transformation_matrix, channel_sigmas)
    elif sigma != 1:
        channel_sigmas = np.diag(
            np.array([sigma for _ in range(len(channels))])
        )
        transformation_matrix = np.dot(transformation_matrix, channel_sigmas)
    # TODO: this 'offset' term does not explicitly exist in the matlab
    #  implementation. check against reference algorithm. it rarely does
    #  anything, though.
    offset = channel_means - np.dot(channel_means, transformation_matrix)
    # remove mean from each channel, transform, replace mean and add offset
    dcs_vectors = (
        np.dot((channel_vectors - channel_means), transformation_matrix)
        + channel_means
        + offset
    )
    dcs_array = dcs_vectors.reshape(input_shape)
    # special limiter included ensuite
    if contrast_stretch is None:
        image = normalize_range(dcs_array)
    else:
        image = enhance_color(dcs_array, (0, 1), contrast_stretch)
    if (isinstance(image, np.ma.MaskedArray)) and (mask_fill_tone is not None):
        image = colorfill_maskedarray(image, mask_fill_tone)
    return image

def normalize_range(
    arr: np.ndarray,
    bounds: tuple[Real, Real] = (0.0, 1.0),
    stretch: Union[float, tuple[float, float], None] = None,
    inplace: bool = False,
    allow_half_float: bool = False,
) -> Union[np.ndarray, np.ma.MaskedArray]:
    """
    simple linear min-max scaler that optionally percentile-clips the input at
    stretch = (low_percentile, 100 - high_percentile). if inplace is True,
    may transform the original array, with attendant memory savings and
    destructive effects.

    Setting bounds[0] >= bounds[1] may cause undesired effects.

    Attempts to maintain dtype of the input array, but will cast if required
    to match bounds. Note that the inplace argument is effectively ignored in
    that case.

    Always ignores masked data in an array when computing scale.
    Arrays with nan values will always return an array of np.nan. Arrays with
    -inf and/or inf values will clip those values to bounds[0] and bounds[1]
    respectively.
    """
    if not isinstance(stretch, Sequence):
        stretch = (stretch, stretch)
    stretch = np.array([0 if i is None else i for i in stretch])
    stretch = np.clip(stretch, 0, 100)
    do_clip = max(stretch) > 0
    if isinstance(arr, np.ma.MaskedArray):
        inrange = find_masked_bounds(arr, *stretch)
    else:
        inrange = find_unmasked_bounds(arr, *stretch)
    inrange = tuple(
        map(lambda i: arr.dtype.type(i) if i is not None else i, inrange)
    )
    if do_clip and set(inrange) != {None}:
        if inplace is True:
            arr = np.clip(arr, *inrange, out=arr)
        else:
            arr = np.clip(arr, *inrange)
    mintype = reduce(
        np.promote_types,
        map(np.min_scalar_type, filter(None, (*inrange, *bounds))),
    )
    if mintype == np.float16 and allow_half_float is False:
        mintype = np.float32
    if not np.can_cast(mintype, arr.dtype):
        arr = arr.astype(mintype)
    # Note that this case will only occur for all-masked input array
    if set(inrange) == {None}:
        return np.clip(arr, *bounds)
    inrange, bounds = map(
        lambda s: np.array(s, arr.dtype.type), (inrange, bounds)
    )
    scale_up, scale_down = map(np.ptp, (bounds, inrange))
    # TODO, maybe: messy
    if arr.dtype.char in np.typecodes["Float"]:
        # nonsensical-looking but effective floating point OOB cheat
        smax = (inrange[1] - inrange[0]) * scale_up / scale_down + bounds[0]
        if smax > bounds[1]:
            scale_up *= 1 + (bounds[1] - smax)
    if inplace is True:
        arr -= inrange[0]
        arr *= scale_up
        if arr.dtype.char in np.typecodes["AllInteger"]:
            # this loss of precision is probably better than
            # automatically typecasting it.
            # TODO, maybe: cute inplace rounding
            arr //= scale_down
        else:
            arr /= scale_down
        arr += bounds[0]
        return arr
    elif arr.dtype.char in np.typecodes["AllInteger"]:
        return ((arr - inrange[0]) * scale_up) // scale_down + bounds[0]
    return (arr - inrange[0]) * scale_up / scale_down + bounds[0]

def enhance_color(image: np.ndarray, bounds, stretch):
    """
    wrapper for normalize_range -- normalize each channel individually,
    conventional "enhanced color" operation
    """
    return split_filter(normalize_range)(image, bounds=bounds, stretch=stretch)

def split_filter(
    filter_function: Callable[[np.ndarray, ...], np.ndarray], axis: int = -1
) -> Callable:
    """
    produce a 'split' version of a function -- notionally an image filter --
    that applies itself to slices across a particular axis. e.g., if passed a
    gaussian blur function, returns a function that applies a gaussian blur to
    R / G / B channels separately and then recomposes them.
    """

    def multi(
        array: np.ndarray, *, set_axis: int = axis, **kwargs: Any
    ) -> np.ndarray:
        filt = partial(filter_function, **kwargs)
        filtered = tuple(
            map(filt, np.split(array, array.shape[set_axis], set_axis))
        )
        if isinstance(filtered[0], np.ma.MaskedArray):
            return np.ma.concatenate(filtered, axis=set_axis)
        return np.concatenate(filtered, axis=set_axis)

    return multi

def find_masked_bounds(
    image: np.ma.MaskedArray, cheat_low: float, cheat_high: float
) -> Union[tuple[Real, Real], tuple[None, None]]:
    """
    relatively memory-efficient way to perform bound calculations for
    normalize_range on a masked array.
    """
    if image.mask is np.False_:
        valid = image.data
    else:
        valid = image[~image.mask].data
    # NOTE: unlike its relative in `pdr.browsify`, this function does not
    #  assume that the masked array it receives has already been masked
    #  where invalid.
    valid = valid[np.isfinite(valid)]
    if valid.size == 0:
        return None, None
    if (cheat_low != 0) and (cheat_high != 0):
        minimum, maximum = np.percentile(
            valid, [cheat_low, 100 - cheat_high], overwrite_input=True
        ).astype(image.dtype)
    elif cheat_low != 0:
        maximum = valid.max()
        minimum = np.percentile(valid, cheat_low, overwrite_input=True).astype(
            image.dtype
        )
    elif cheat_high != 0:
        minimum = valid.min()
        maximum = np.percentile(
            valid, 100 - cheat_high, overwrite_input=True
        ).astype(image.dtype)
    else:
        minimum = valid.min()
        maximum = valid.max()
    return minimum, maximum

def find_unmasked_bounds(
    image: np.ndarray, cheat_low: float, cheat_high: float
) -> tuple[Real, Real]:
    """straightforward way to find unmasked array bounds for normalize_range"""
    if cheat_low != 0:
        minimum = np.percentile(image, cheat_low).astype(image.dtype)
    else:
        minimum = image.min()
    if cheat_high != 0:
        maximum = np.percentile(image, 100 - cheat_high).astype(image.dtype)
    else:
        maximum = image.max()
    return minimum, maximum

def colorfill_maskedarray(
    masked_array: np.ma.MaskedArray,
    color: Union[float, tuple[float, float, float]] = 0.45,
    mask_alpha=None,
    unmasked_alpha=None,
) -> np.ndarray:
    """
    masked_array: 2-D masked array or a 3-D masked array with last axis of
    length 3. should be float normalized to 0-1.
    color: optionally-specified RGB color or single integer for gray
    (default medium gray).
    if both alpha parameters are None, return a 3-D array with masked values
    filled with color.
    otherwise, return a 4-D array (last axis intended as an alpha plane),
    with alpha value equal to unmasked_alpha outside the mask and masked_alpha
    inside the mask (either defaults to 0 if not set)
    """
    if (mask_alpha is None) and (unmasked_alpha is not None):
        mask_alpha = 0
    if (unmasked_alpha is None) and (mask_alpha is not None):
        unmasked_alpha = 0
    if len(masked_array.shape) == 2:
        if isinstance(color, (int, float)):
            color = (color, color, color)
        stack = [masked_array.filled(color[ix]) for ix in range(3)]
        if mask_alpha is not None:
            stack.append(
                make_mask_canvas(masked_array, unmasked_alpha, mask_alpha)
            )
        return np.dstack(stack)
    if masked_array.shape[-1] != 3:
        raise ValueError("3-D arrays must have last axis of length = 3")
    if isinstance(color, (int, float)):
        stack = masked_array.filled(color)
    else:
        stack = np.dstack(
            [masked_array[:, :, ix].filled(color[ix]) for ix in range(3)]
        )
    if mask_alpha is None:
        return stack
    return np.dstack(
        [stack, make_mask_canvas(stack, unmasked_alpha, mask_alpha)]
    )

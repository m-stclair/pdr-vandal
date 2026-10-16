"""Assertion helpers that report scientific failures usefully."""
import numpy as np


def assert_close(actual, expected, tol, label="values"):
    """
    Assert max |actual - expected| <= tol over finite expected values, and
    that NaNs occur in exactly the same places. On failure, report the max
    error, where it occurs, and the tolerance.
    """
    actual = np.asarray(actual, dtype=np.float64)
    expected = np.asarray(expected, dtype=np.float64)
    assert actual.shape == expected.shape, (
        f"{label}: shape {actual.shape} != expected {expected.shape}")
    nan_a, nan_e = np.isnan(actual), np.isnan(expected)
    mismatch = int((nan_a != nan_e).sum())
    assert mismatch == 0, f"{label}: NaN placement differs at {mismatch} positions"
    err = np.where(nan_e, 0.0, np.abs(actual - expected))
    worst = float(err.max()) if err.size else 0.0
    if worst > tol:
        idx = np.unravel_index(int(err.argmax()), err.shape)
        raise AssertionError(
            f"{label}: max |error| {worst:.3e} at {tuple(int(i) for i in idx)} "
            f"(got {actual[idx]:.9g}, expected {expected[idx]:.9g}); "
            f"tolerance {tol:.1e}"
        )


def assert_equal(actual, expected, label="values"):
    """Bit-exact equality (NaN == NaN)."""
    assert_close(actual, expected, 0.0, label)

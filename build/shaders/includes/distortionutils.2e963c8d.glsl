// distortionutils.glsl
//
// Utility functions for spatially sparse and clamped UV distortion.
// Designed to work with 2D noise fields in fragment shaders.

#ifndef DISTORTIONUTILS_GLSL
#define DISTORTIONUTILS_GLSL

// === Sparse Clamp Distortion ===
// Applies distortion but suppresses displacements below a certain magnitude.
// `clampScale` sets the effective "activation" range.
// `useSoftClamp` applies smoothstep-based falloff instead of hard clipping.
vec2 sparseClampDistort(
    vec2 uv,
    vec2 noiseOut,
    float strength,
    float clampScale,
    bool useSoftClamp
) {
    vec2 clamped = useSoftClamp
        ? smoothstep(-clampScale, clampScale, noiseOut) * 2.0 * clampScale
        : clamp(noiseOut, -clampScale, clampScale);

    return uv + clamped * strength;
}

// === Sparse Patch Distortion ===
// Zeros out noise vectors whose magnitude is below `threshold`.
// Creates discrete "on/off" patches of distortion.
vec2 sparsePatchDistort(
    vec2 uv,
    vec2 noiseOut,
    float threshold,
    float strength
) {
    float mask = step(threshold, length(noiseOut));
    return uv + noiseOut * strength * mask;
}

// === Grid Snap ===
// Snap UV coordinates to a discrete grid based on frequency.
// Useful for creating spatial quantization or patch regions.
vec2 gridSnap(vec2 uv, float freq) {
    return floor(uv * freq) / freq;
}

// === Patchy Distortion with Grid Snapping ===
// Applies distortion only at snapped grid points. If noiseOut is ~zero, suppresses distortion.
vec2 applyPatchyDistortion(
    vec2 uv,
    vec2 noiseOut,
    float freq,
    float strength
) {
    vec2 snapped = gridSnap(uv, freq);
    float mask = step(0.001, length(noiseOut));  // suppress degenerate vectors
    return mix(uv, snapped + noiseOut * strength, mask);
}

// === High-contrast Masked Distortion ===
// For artistic control: apply a nonlinear ramp to enhance large displacements.
vec2 contrastDistort(
    vec2 uv,
    vec2 noiseOut,
    float strength,
    float gamma
) {
    float mag = length(noiseOut);
    vec2 dir = normalize(noiseOut);
    float ramp = pow(mag, gamma);
    return uv + dir * ramp * strength;
}

#endif // DISTORTIONUTILS_GLSL

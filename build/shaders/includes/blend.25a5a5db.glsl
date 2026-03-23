vec3 applyBlend(vec3 base, vec3 fx, float blendAmount) {
vec3 blended;
#if BLENDMODE == 0  // Replace
    blended = fx;
#elif BLENDMODE == 1  // Mix
    blended = mix(base, fx, blendAmount);
#elif BLENDMODE == 2  // Add
    blended = base + fx * blendAmount;
#elif BLENDMODE == 3  // Multiply
    blended = mix(base, base * fx, blendAmount);
#elif BLENDMODE == 4  // Screen
    vec3 screen = 1.0 - (1.0 - base) * (1.0 - fx);
    blended = mix(base, screen, blendAmount);
#elif BLENDMODE == 5  // Overlay
    vec3 overlay = mix(
        2.0 * base * fx,
        1.0 - 2.0 * (1.0 - base) * (1.0 - fx),
        step(0.5, base)
    );
    blended = mix(base, overlay, blendAmount);
#elif BLENDMODE == 6  // Darken
    blended = mix(base, min(base, fx), blendAmount);
#elif BLENDMODE == 7  // Lighten
    blended = mix(base, max(base, fx), blendAmount);
#elif BLENDMODE == 8  // Difference
    vec3 diff = abs(base - fx);
    blended = mix(base, diff, blendAmount);
#elif BLENDMODE == 9  // Soft Light
    vec3 result = mix(
        2.0 * base * fx + base * base * (1.0 - 2.0 * fx),
        sqrt(base) * (2.0 * fx - 1.0) + 2.0 * base * (1.0 - fx),
        step(fx, vec3(0.5))
    );
    blended = mix(base, clamp(result, 0., 1.), blendAmount);
#elif BLENDMODE == 10  // Hard Light
    vec3 result = mix(
        2.0 * base * fx,
        1.0 - 2.0 * (1.0 - base) * (1.0 - fx),
        step(0.5, fx)
    );
    blended = mix(base, result, blendAmount);
#else
    blended = fx;
#endif
    return blended;
}

float applyBlend(float base, float fx, float blendAmount) {
#if BLENDMODE == 0  // Replace
    return fx;
#elif BLENDMODE == 1  // Mix
    return mix(base, fx, blendAmount);
#elif BLENDMODE == 2  // Add
    return base + fx * blendAmount;
#elif BLENDMODE == 3  // Multiply
    return mix(base, base * fx, blendAmount);
#elif BLENDMODE == 4  // Screen
    float screen = 1.0 - (1.0 - base) * (1.0 - fx);
    return mix(base, screen, blendAmount);
#elif BLENDMODE == 5  // Overlay
    float overlay = base < 0.5
        ? 2.0 * base * fx
        : 1.0 - 2.0 * (1.0 - base) * (1.0 - fx);
    return mix(base, overlay, blendAmount);
#elif BLENDMODE == 6  // Darken
    return mix(base, min(base, fx), blendAmount);
#elif BLENDMODE == 7  // Lighten
    return mix(base, max(base, fx), blendAmount);
#elif BLENDMODE == 8  // Difference
    float diff = abs(base - fx);
    return mix(base, diff, blendAmount);
#elif BLENDMODE == 9  // Soft Light
    float result = fx < 0.5
        ? 2.0 * base * fx + base * base * (1.0 - 2.0 * fx)
        : sqrt(base) * (2.0 * fx - 1.0) + 2.0 * base * (1.0 - fx);
    return mix(base, result, blendAmount);
#elif BLENDMODE == 10  // Hard Light
    float result = fx < 0.5
        ? 2.0 * base * fx
        : 1.0 - 2.0 * (1.0 - base) * (1.0 - fx);
    return mix(base, result, blendAmount);
#else
    return fx;
#endif
}

#ifndef BLEND_CHANNEL_MODE
#define BLEND_CHANNEL_MODE 0
#endif

vec3 blendChannelMasked(vec3 base, vec3 fx, float blendAmount) {
#if BLEND_CHANNEL_MODE == 0  // ALL
    return applyBlend(base, fx, blendAmount);
#elif BLEND_CHANNEL_MODE == 1
    return vec3(
        applyBlend(base.x, fx.x, blendAmount),
        base.yz
    );
#elif BLEND_CHANNEL_MODE == 2
    return vec3(
        base.x,
        applyBlend(base.y, fx.y, blendAmount),
        base.z
    );
#elif BLEND_CHANNEL_MODE == 3
    return vec3(
        base.xy,
        applyBlend(base.z, fx.z, blendAmount)
    );
#else
    return base;
#endif
}


vec3 blendWithColorSpace(vec3 baseRGB, vec3 fxRGB, float blendAmount) {
    vec3 base = extractColor(baseRGB);
    vec3 fx = extractColor(fxRGB);
    vec3 blended = blendChannelMasked(base, fx, blendAmount);
    return encodeColor(blended);
}

vec3 blendWithColorSpace(vec3 baseRGB, float fxGray, float blendAmount) {
    vec3 base = extractColor(baseRGB);
    vec3 blended = blendChannelMasked(base, vec3(fxGray), blendAmount);
    return encodeColor(blended);
}

vec3 blendWithColorSpace(float baseGray, float fxGray, float blendAmount) {
    vec3 blended = blendChannelMasked(vec3(baseGray), vec3(fxGray), blendAmount);
    return encodeColor(blended);
}

#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_bandSize;
uniform float u_mirrorRate;
uniform float u_offset;
uniform float u_seed;
uniform float u_blendamount;
uniform int u_orientation;
uniform int u_levels;
uniform float u_rotationAmount;
uniform float u_vBias;
uniform float u_sBias;
uniform float u_hue;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#define FLIP_COLOR_RANDOM 0
#define FLIP_COLOR_SWEEP 1
#define FLIP_COLOR_TINT 2

#ifndef FLIP_COLOR_MODE
#define FLIP_COLOR_MODE 0
#endif

const int MAX_LEVELS = 10;

float random(vec2 st) {
    return fract(sin(dot(st.xy ,vec2(12.9898,78.233))) * 43758.5453);
}


vec2 rotate(vec2 pt, float angle, vec2 center) {
    float s = sin(angle);
    float c = cos(angle);
    pt -= center;
    mat2 rot = mat2(c, -s, s, c);
    return rot * pt + center;
}


vec2 applyMirror(vec2 uv, float bandSize, float mirrorRate, float offset, int orientation, float seed) {
    float slabVal = floor((orientation == 0 ? uv.y : uv.x) / bandSize);
    bool mirrored = random(vec2(slabVal, seed)) < mirrorRate;
    float slabOrigin = slabVal * bandSize;
    float within = (orientation == 0 ? uv.y : uv.x) - slabOrigin;
    float coord = mirrored ? slabOrigin + bandSize - within - 1.0
                           : (orientation == 0 ? uv.y : uv.x);
    float offsetCoord = mirrored ? (orientation == 0 ? uv.x : uv.y) + offset
                                 : (orientation == 0 ? uv.x : uv.y);
    return (orientation == 0) ? vec2(offsetCoord, coord)
                              : vec2(coord, offsetCoord);
}


vec3 randomizeColor(float slabVal, float hue, float sBias, float vBias) {
    float saturation = sBias + random(vec2(slabVal + 10.0, u_seed)) * 0.5;
    float brightness = vBias + random(vec2(slabVal + 20.0, u_seed)) * 0.5;
    return hsv2rgb(vec3(hue, clamp(saturation, 0., 1.), clamp(brightness, 0., 1.)));
}

vec2 rotateBack(vec2 pt, float angle, vec2 center) {
    // Inverse rotation (reverse the effect of `rotate`)
    float s = sin(angle);
    float c = cos(angle);
    pt -= center;
    mat2 rot = mat2(c, s, -s, c);
    return rot * pt + center;
}

void main() {
    // TODO: this is not uv!!!
    vec2 uv = gl_FragCoord.xy;
    vec2 src = uv;
    vec3 accumulatedColor = vec3(0.0);

    vec2 center = vec2(0.5, 0.5) * u_resolution;
    int currentOrientation = u_orientation;
    for (int i = 0; i < MAX_LEVELS; i++) {
        if (i >= u_levels) break;
        float f = float(i + 1);
        float scale = pow(0.5, f);
        float thisBand = u_bandSize * scale;
        float thisOffset = u_offset * scale;
        float thisMirrorRate = u_mirrorRate * mix(1.0, 0.5, f / float(u_levels));
        float angle = u_rotationAmount * f;
        float radialWeight = 1.0 / (1.0 + length(src - center) / (u_resolution.x * 0.5));
        vec2 rotated = rotate(src, angle * radialWeight, center);
        src = applyMirror(rotated, thisBand, thisMirrorRate,
        thisOffset, currentOrientation, u_seed * f);

        vec2 rotatedBack = rotateBack(src, -angle * radialWeight, center);

        float slab = ((u_orientation == 0 ? rotatedBack.y : rotatedBack.x) + thisOffset) / thisBand;
        float slabVal = floor(slab);
#if FLIP_COLOR_MODE == FLIP_COLOR_RANDOM
        float hue = random(vec2(slabVal, u_seed));
#elif FLIP_COLOR_MODE == FLIP_COLOR_SWEEP
        float hue = slab * slab / u_bandSize;
#else
        float hue = u_hue;
#endif
        vec3 tint = randomizeColor(slabVal, hue, u_sBias, u_vBias);
        vec3 baseColor = texture(u_image, fract(src / u_resolution)).rgb;
#if FLIP_COLOR_BLEND == 0
        accumulatedColor += baseColor.rgb * tint;
#else
        accumulatedColor = baseColor.rgb * tint;
#endif
        currentOrientation = (currentOrientation + 1) % 2;
    }
#if FLIP_COLOR_BLEND == 0
    accumulatedColor /= float(u_levels);
#endif
    src = clamp(src, vec2(0.0), u_resolution - 1.0);
    vec4 color = texture(u_image, uv / u_resolution);
    outColor = vec4(
        blendWithColorSpace(color.rgb, accumulatedColor, u_blendamount),
        1.0
    );
}


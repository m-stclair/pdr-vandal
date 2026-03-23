#version 300 es

precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_freq;
uniform float u_freqScale;
uniform float u_phaseScale;
uniform float u_phaseOff; // radians
uniform float u_blend;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#define WAVEFORM_SIN 0
#define WAVEFORM_SAW 1
#define WAVEFORM_SQUARE 2
#define WAVEFORM_TRI 3

float waveform(float x) {
#if WAVEFORM_MODE == WAVEFORM_SIN
    return sin(x);
#elif WAVEFORM_MODE == WAVEFORM_SAW
    return fract(x / 6.28318); // normalize to [0,1]
#elif WAVEFORM_MODE == WAVEFORM_SQUARE
    return sign(sin(x)); // returns -1 or +1
#elif WAVEFORM_MODE == WAVEFORM_TRI
    return abs(fract(x / 6.28318) * 2.0 - 1.0); // triangle wave
#else
    return sin(x); // default fallback
#endif
}

#define SPATIAL_XY 0
#define SPATIAL_CHECKER 1
#define SPATIAL_RADIAL 2
#define SPATIAL_RINGS 3
#define SPATIAL_NONE 4


float spatialPattern(vec2 uv, float freq) {
#if SPATIAL_MODE == SPATIAL_NONE
    return 0.0;
#elif SPATIAL_MODE == SPATIAL_XY
    return uv.x + uv.y;
#elif SPATIAL_MODE == SPATIAL_CHECKER
    float s = sin(uv.x * freq * 3.14159) * sin(uv.y * freq * 3.14159);
    return s; // pattern in [-1, 1]
#elif SPATIAL_MODE == SPATIAL_RADIAL
    vec2 center = vec2(0.5);
    float dist = length(uv - center);
    return dist * freq;
#elif SPATIAL_MODE == SPATIAL_RINGS
    vec2 center = vec2(0.5);
    float angle = atan(uv.y - center.y, uv.x - center.x);
    return angle * freq;
#else
    return uv.x + uv.y;
#endif
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);
    vec3 color = pix.rgb;

    float luma = luminance(color);
    float phase = luma * 6.28318; // 2π

    float spatial = spatialPattern(uv, u_freq); // just uv.x + uv.y
    float patternA = waveform(spatial * u_freqScale + phase);
    float patternB = waveform(-phase * (spatial * u_freqScale + phase * u_phaseScale) + u_phaseOff);
    float patval = abs(patternA - patternB);
    // grayscale for now
    vec3 blended = blendWithColorSpace(vec3(color), patval, u_blend);
    outColor = vec4(blended, 1.0);
}

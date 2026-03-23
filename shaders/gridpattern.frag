#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_width;         // band width
uniform vec2 u_phase;         // offset/shifting of pattern
uniform float u_softness;      // edge falloff for antialiasing (0 = hard)
uniform float u_blendamount;
uniform float u_spacingfactor;
uniform float u_skew; // 0 = no skew, 1 = 45 deg, -1 = -45 deg
uniform float u_noisescale;
uniform float u_noiseamount;
uniform float u_lumamod;
uniform float u_lumathreshold;
uniform float u_luma_angle;
uniform vec3 u_channelphase;
uniform vec3 u_color;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#define DIRECTION_VERTICAL 0
#define DIRECTION_HORIZONTAL 1
#define DIRECTION_GRID 2
#ifndef DIRECTION
#define DIRECTION DIRECTION_VERTICAL
#endif

#define MODE_BINARY 0
#define MODE_SINE 1
#define MODE_TRI 2
#define MODE_SAW 3
#ifndef MODE
#define MODE MODE_BINARY
#endif

// TODO: use hash()
float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453);
}

vec2 jitteredUV(vec2 uv, float amount, float scale) {
    float n = rand(uv) - 0.5;
    float g = rand(uv + n);
    return uv + n * step(g, amount) * scale;
}

float waveFunction(float coord, float phase) {
    float spacing = u_width * u_spacingfactor;
    float local = mod(coord + phase, spacing);
    #if MODE == MODE_BINARY
    // Stripe is "on" when in the upper portion of spacing cycle
    return step(spacing - u_width, local);
    #elif MODE == MODE_SINE
    return 0.5 + 0.5 * sin(6.2831 * (coord + phase) / spacing);
    #elif MODE == MODE_TRI
    return abs(fract((coord + phase) / spacing) * 2.0 - 1.0);
    #elif MODE == MODE_SAW
    return fract((coord + phase) / spacing);
    #else
    return 1.0;
    #endif
}

float gridPattern(vec2 uv, float phase) {
    vec2 pixelCoord = uv * u_resolution;
#if DIRECTION == DIRECTION_HORIZONTAL
    return waveFunction(pixelCoord.y + u_skew * pixelCoord.x, phase);
#elif DIRECTION == DIRECTION_VERTICAL
    return waveFunction(pixelCoord.x + u_skew * pixelCoord.y, phase);
#elif DIRECTION == DIRECTION_GRID
    float gx = waveFunction(pixelCoord.x + u_skew * pixelCoord.y, u_phase.x + phase);
    float gy = waveFunction(pixelCoord.y + u_skew * pixelCoord.x, u_phase.y + phase);
    return gx * gy;
#else
    return waveFunction(pixelCoord.y, phase);
#endif
}


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
#if ADD_NOISE == 1
    vec2 grid_uv = jitteredUV(uv, u_noiseamount, u_noisescale);
#else
    vec2 grid_uv = uv;
#endif
    vec4 pix = texture(u_image, uv);
    vec3 srgb = pix.rgb;
    vec3 pattern = vec3(
        gridPattern(grid_uv, u_channelphase.x),
        gridPattern(grid_uv, u_channelphase.y),
        gridPattern(grid_uv, u_channelphase.z)
    );
#if INVERT == 1
    pattern = 1.0 - pattern;
#endif
#if MOD_LUMA == 1
    float lum = luminance(srgb);
    float flip = clamp(-u_lumamod, 0.0, 1.0);
    vec3 modulated = mix(pattern, 1.0 - pattern, flip);
    float amp = mix(1.0, lum, abs(u_lumamod));
    float mask = 1.0 - smoothstep(u_lumathreshold, u_lumathreshold + u_luma_angle, lum);
    pattern = modulated * amp * mask;
#endif
    vec3 blended = blendWithColorSpace(
        srgb,
        pattern * u_color,
        u_blendamount
    );
    outColor = vec4(blended, pix.a);
}

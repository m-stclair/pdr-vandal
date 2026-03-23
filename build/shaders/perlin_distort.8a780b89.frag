#version 300 es

precision mediump float;

#include "noisenums.glsl"
#include "noise.glsl"
#include "classicnoise2D.glsl"
#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_pitch;
uniform vec2 u_resolution;
uniform vec2 u_freq;
uniform float u_fc[3];
uniform float u_seed;
uniform int u_boundmode;
uniform float u_depth;
uniform float u_rate;
uniform float u_ratedrive;
uniform vec2 u_phase;
uniform float u_fuzz;
uniform int u_noisemode;
uniform float u_clampscale;
uniform vec2 u_reps;
uniform float u_blendAmount;
out vec4 outColor;

void main() {
    vec2 uv = (gl_FragCoord.xy) / u_resolution;
    vec2 uv0 = uv;
    if (u_ratedrive > 0.) {
        uv = uv * (1. - u_ratedrive) + sin(uv * u_rate + u_phase * 6.2831853) * u_ratedrive;
    }
    float fuzzX = u_fuzz * (uniformNoise(uv.x * uv.y) - 0.5);
    float fuzzY = u_fuzz * (uniformNoise(uv.x * uv.y + 0.1) - 0.5);
    uv = vec2(uv.x + fuzzX, uv.y + fuzzY);
#if NOISEMODE == 0
    float grad[4] = float[](1., 0., 0., 1.);
    float pX = (perlinNoise2D(
        u_freq * (uv + u_pitch), u_fc, grad, u_seed
    ) * 2. - 1.).x;
    vec2 noiseOut = vec2(pX);
#elif NOISEMODE == 1
    vec2 noiseOut = vec2(cnoise(u_freq * (uv + u_pitch + u_seed)));
#elif NOISEMODE == 2
    vec2 noiseOut = vec2(pnoise(u_freq * (uv + u_pitch + u_seed), u_reps));
#else
    vec2 noiseOut = cellular(u_freq * uv + u_pitch + u_seed);
#endif
#if BOUNDMODE == 2
    noiseOut = clamp(noiseOut, -u_clampscale, u_clampscale) + u_clampscale;
#endif
    uv += noiseOut * u_depth;
#if BOUNDMODE == 0
    uv = fract(uv);
#endif
    outColor = vec4(
        blendWithColorSpace(texture(u_image, uv0).rgb, texture(u_image, uv).rgb, u_blendAmount),
        1.0
    );
}

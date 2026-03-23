#version 300 es
precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;

// --- Structs for grouped uniforms ---
struct TearParams {
    float amount;
    float ghostOffset;
    float chunks;
};

struct ModulationParams {
    float seed;
    float scale;
    float t;
    float bias;
    float jitter;
    float flickerAmount;
    float noiseAmount;
    float blendAmount;
};

// --- Uniforms ---
uniform TearParams u_tear;
uniform ModulationParams u_mod;

out vec4 outColor;

// --- Mode constants ---
#define TEAR_WAVE   0
#define TEAR_JUMP   1
#define TEAR_BAND   2
#define TEAR_CHUNK  3
#define TEAR_GHOST  4

// --- Hash function ---
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

// --- Value noise ---
float valueNoise(vec2 uv) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    f = f * f * (3.0 - 2.0 * f); // smoothstep

    float u = mix(a, b, f.x);
    float v = mix(c, d, f.x);
    return mix(u, v, f.y);
}

// --- Tearing logic ---
vec2 applyTear(vec2 uv, TearParams tp, float time) {
#if TEARMODE == TEAR_WAVE
    uv.x += sin(uv.y * 60.0 * tp.chunks + time * 3.0) * 0.07;

#elif TEARMODE == TEAR_JUMP
    float tearLine = fract(time * 0.2);
    float jump = step(abs(uv.y - tearLine), 0.001 * sqrt(tp.chunks));
    uv.x += jump * 0.2;

#elif TEARMODE == TEAR_BAND
    float band = smoothstep(0.45, 0.46, uv.y) - smoothstep(0.46, 0.47, uv.y);
    uv.x += band * (fract(sin(time * 12.9898) * 43758.5453) - 0.5) * 0.5;

#elif TEARMODE == TEAR_CHUNK
    float chunk = floor(uv.y * tp.chunks);
    float offset = fract(sin(dot(vec2(chunk, time), vec2(12.9898, 78.233))) * 43758.5453);
    uv.x += (offset - 0.5) * 0.2;

#elif TEARMODE == TEAR_GHOST
    uv.x += tp.ghostOffset * smoothstep(fract(time), 0.1 + fract(time), uv.y);
#endif

    return uv;
}

// --- Bad modulation ---
float badModulation(vec2 uv, ModulationParams mp) {
    vec2 warpedUV = uv;
    warpedUV.x *= 1.0 - mp.bias;
    warpedUV.y *= mp.bias;

    warpedUV.y += (hash(vec2(mp.t, floor(uv.y * 100.0))) - 0.5) * 0.01 * mp.jitter;

    return valueNoise(warpedUV * mp.scale + mp.seed * 7.77);
}

// --- Main ---
void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 tearUV = mix(uv, applyTear(uv, u_tear, u_mod.t), u_tear.amount);

    float noiseVal = badModulation(tearUV, u_mod) * u_mod.noiseAmount;
    float flickerVal = sin(u_mod.t * 3.0 + tearUV.y * 2.0) * 0.05 * u_mod.flickerAmount;

    vec3 sampled = texture(u_image, tearUV).rgb * (1.0 - u_mod.noiseAmount);
    vec3 noised = clamp(sampled + noiseVal + flickerVal, 0., 1.);

    vec3 inColor = texture(u_image, uv).rgb;
    vec3 blended = blendWithColorSpace(inColor, noised, u_mod.blendAmount);

    outColor = vec4(blended, texture(u_image, uv).a);
}
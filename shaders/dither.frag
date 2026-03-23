#version 300 es

precision mediump float;

#include "noisenums.glsl"
#include "zones.glsl"
#include "colorconvert.glsl"
#include "noise.glsl"
#include "blend.glsl"
#include "psrdnoise2.glsl"
#include "classicnoise2D.glsl"
#include "cellular2D.glsl"
#include "noise2D.glsl"

uniform sampler2D u_image;
uniform sampler2D u_cmap;
uniform vec2 u_resolution;
uniform float u_uniform;
uniform float u_perlin;
uniform float u_simplex;
uniform float u_gauss;
uniform float u_brown;
uniform float u_value;
uniform float u_worley;
uniform float u_blendamount;
uniform float u_scale;
uniform float u_levels;
uniform float u_seed;
uniform vec3 u_tint;

out vec4 outColor;


void main() {
    vec2 uv = (gl_FragCoord.xy + vec2(0.5)) / u_resolution;
    vec2 uvjit = uv + uniformNoise(u_seed);
    vec2 uvs = uvjit * u_scale;

    // math from noise mixer
    float noiseVal = 0.0;
    noiseVal += uniformNoise(uvjit.x * uvjit.y) * u_uniform;
    noiseVal += cnoise(uvs) * u_perlin * 1.4;
    vec2 gradientOut = vec2(0.0, 0.0);  // scratch space for periodic simplex noise algo
    noiseVal += psrdnoise(uvs, vec2(0.0), 0.0, gradientOut) * u_simplex * 1.3;
    noiseVal += gaussianNoise(uvs) * u_gauss;
    noiseVal += brownNoise(uvs) * u_brown;
    noiseVal += valueNoise(uvs) * u_value;
    vec2 cellnoise = cellular(uvs) * u_worley;
    noiseVal += (cellnoise.x + cellnoise.y) / 2.;
    noiseVal = clamp(noiseVal, 0.0, 1.0);

    vec3 srgbIn = texture(u_image, uv).xyz;
    float luma = srgb2NormLab(srgbIn).x;
    float n = u_levels - 1.0;
    float quantized = floor(luma * n + noiseVal) / n;
    float thresholded = clamp(quantized, 0.0, 1.0);
    #if USE_CMAP == 0
        vec3 tinted = thresholded * u_tint;
    #else
        vec3 tinted = texture(u_cmap, vec2(thresholded, 0.5)).rgb * u_tint;
    #endif

    vec3 blended = blendWithColorSpace(srgbIn, tinted, u_blendamount);
    outColor = vec4(clamp(blended, 0.0, 1.0), texture(u_image, uv).a);
}
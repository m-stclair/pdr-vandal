#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_density;
uniform float u_blendamount;
uniform float u_chromaThreshold;

out vec4 outColor;

#include "colorconvert.glsl"
#include "noise.glsl"

#define SHRED_COLOR_DISJOINT 0
#define SHRED_COLOR_JOINT 1
#define SHRED_PRESERVE_LUMA 2

#ifndef SHRED_COLOR_MODE
#define SHRED_COLOR_MODE SHRED_COLOR_DISJOINT
#endif

void main() {
    vec2 uv = (gl_FragCoord.xy) / u_resolution;
    const float C1 = 7.77;
    const float C2 = 48.131;
    const float C3 = 2.13;
    vec3 src = texture(u_image, uv).rgb;

#if SHRED_COLOR_MODE == SHRED_PRESERVE_LUMA
    vec3 lch = srgb2NormLCH(src);
#endif

float chroma = 0.0;
#if CHROMA_THRESHOLDING == 1

#if SHRED_COLOR_MODE == SHRED_PRESERVE_LUMA
    chroma = lch.y;
#else
    chroma = length(src - vec3(dot(src, vec3(0.333))));
#endif
#if INVERT_CHROMA_THRESHOLD == 1
    if (chroma > u_chromaThreshold) {
#else
    if (chroma < u_chromaThreshold) {
#endif
        outColor = vec4(src, 1.0);
        return;
    }
#endif
#if SHRED_COLOR_MODE == SHRED_COLOR_DISJOINT
    vec2 uvR = hash2d_uv(uv);
    vec2 uvG = hash2d_uv(uv * 1.67);
    vec2 uvB = hash2d_uv(uv * 2.37 + 0.3);
    float rsrc = mix(src.r, texture(u_image, uvR).r, step(hash(uv), u_density));
    float gsrc = mix(src.g, texture(u_image, uvG).g, step(hash(uv), u_density));
    float bsrc = mix(src.b, texture(u_image, uvB).b, step(hash(uv), u_density));
    vec3 shredded = vec3(rsrc, gsrc, bsrc);
#elif SHRED_COLOR_MODE == SHRED_COLOR_JOINT
    vec2 uvAlt = hash2d_uv(uv);
    vec3 shredded = mix(src, texture(u_image, uvAlt).rgb, step(hash(uv), u_density));
#elif SHRED_COLOR_MODE == SHRED_PRESERVE_LUMA
    vec2 uvAlt = hash2d_uv(uv);
    vec3 altLCH = srgb2NormLCH(texture(u_image, uvAlt).rgb);
    vec3 shredded = mix(
        src,
        normLCH2SRGB(vec3(lch.x, altLCH.y, altLCH.z)),
        step(hash(uv), u_density)
    );
#else
    shredded = vec3(1., 0., 1.);  // error fallback
#endif
    outColor = vec4(shredded, 1.0);
}



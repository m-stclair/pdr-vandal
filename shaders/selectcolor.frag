#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_hue;
uniform float u_width;
uniform float u_knee;
uniform float u_blendAmount;

out vec4 outColor;

#ifndef FLIP
#define FLIP 0
#endif

#include "blend.glsl"
#include "colorconvert.glsl"

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 inColor = texture(u_image, uv).rgb;
    vec3 lch = srgb2NormLCH(inColor);
#if FLIP == 0
    float d = abs(lch.z - u_hue);
#else
    float d = 1 - abs(lch.z - u_hue);
#endif
    float t = smoothstep(u_width - u_knee, u_width, d);
    lch.y *= 1.0 - t;
    outColor = blendWithColorSpace(inColor, normLCH2SRGB(lch), u_blendAmount);
}
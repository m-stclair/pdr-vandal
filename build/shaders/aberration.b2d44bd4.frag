#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec2 u_shift0;
uniform vec2 u_shift1;
uniform vec2 u_shift2;
uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

// TODO: expose boundary mode
vec3 aberration(sampler2D tex, vec2 uv, vec2 shift0, vec2 shift1, vec2 shift2) {
    float r = extractColor(texture(tex, uv + shift0).rgb).r;
    float g = extractColor(texture(tex, uv + shift1).rgb).g;
    float b = extractColor(texture(tex, uv + shift2).rgb).b;
    return vec3(r, g, b);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 aberrant = aberration(u_image, uv, u_shift0, u_shift1, u_shift2);
    vec3 color = extractColor(texture(u_image, uv).rgb);
    outColor = vec4(encodeColor(applyBlend(color, aberrant, u_blendamount)), 1.);
}
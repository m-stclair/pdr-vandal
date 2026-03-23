#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_threshold;
uniform float u_blendamount;
uniform vec3 u_tint;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

float luminanceAt(vec2 offset) {
    return luminance(srgb2linear(texture(u_image, offset).rgb));
}

// Edge magnitude via Sobel operator
float sobelEdge(vec2 uv) {
    vec2 texel = 1.0 / u_resolution;
    float tl = luminanceAt(uv + texel * vec2(-1.0, -1.0));
    float  l = luminanceAt(uv + texel * vec2(-1.0,  0.0));
    float bl = luminanceAt(uv + texel * vec2(-1.0,  1.0));
    float  t = luminanceAt(uv + texel * vec2( 0.0, -1.0));
    float  b = luminanceAt(uv + texel * vec2( 0.0,  1.0));
    float tr = luminanceAt(uv + texel * vec2( 1.0, -1.0));
    float  r = luminanceAt(uv + texel * vec2( 1.0,  0.0));
    float br = luminanceAt(uv + texel * vec2( 1.0,  1.0));

    float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
    float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;

    return length(vec2(gx, gy));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    float edgeStrength = sobelEdge(uv);
    float edgeMask = step(u_threshold, edgeStrength);
    vec3 edgeColor = vec3(edgeMask);
    vec3 original = texture(u_image, uv).rgb;
    edgeColor *= u_tint;
    vec3 blended = blendWithColorSpace(original, edgeColor, u_blendamount);
    outColor = vec4(blended, 1);
}
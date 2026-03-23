#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_blocksize;
uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

vec2 pixelUV(vec2 uv, vec2 resolution, float blockSize) {
    vec2 gridUV = floor(uv * resolution / blockSize) * blockSize / resolution;
    return gridUV;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 blended = blendWithColorSpace(
        texture(u_image, uv).rgb,
        texture(u_image, pixelUV(uv, u_resolution, u_blocksize)).rgb,
        u_blendamount
    );
    outColor = clamp(vec4(blended, 1.0), 0., 1.);
}



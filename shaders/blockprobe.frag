#version 300 es

precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform int u_kernelSizeX;
uniform int u_kernelSizeY;
uniform vec2 u_patchOrigins[150];

out vec4 outColor;

#include "colorconvert.glsl"

void main() {
    int patchIndex = int(gl_FragCoord.y);
    vec2 patchOrigin = u_patchOrigins[patchIndex];
    vec3 sum = vec3(0.0);
    for (int dx = 0; dx < u_kernelSizeX; ++dx) {
        for (int dy = 0; dy < u_kernelSizeY; ++dy) {
            vec2 coord = patchOrigin + vec2(dx, dy);
            vec2 uv = coord / u_resolution;
            vec3 srgb = texture(u_image, uv).rgb;
            vec3 lab = rgb2lab(srgb2linear(srgb));
            sum += lab;
        }
    }

    float denom = float(u_kernelSizeX * u_kernelSizeY);
    vec3 mean = sum / denom;
    outColor = vec4(mean, 1.0);
}

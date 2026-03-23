#version 300 es
precision mediump float;

#ifndef KERNEL_SIZE
#define KERNEL_SIZE 9
#endif

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_kernel[KERNEL_SIZE];
uniform int u_kernelWidth;
uniform int u_kernelHeight;
uniform float u_blendamount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;

    vec3 accum = vec3(0.0);
    int k = 0;

    int halfWidth = u_kernelWidth / 2;
    int halfHeight = u_kernelHeight / 2;

    for (int y = 0; y < KERNEL_SIZE; y++) {
        if (y >= u_kernelHeight) break;
        for (int x = 0; x < KERNEL_SIZE; x++) {
            if (x >= u_kernelWidth) break;
            // TODO, maybe: wrap or clamp
            vec2 offset = vec2(float(x - halfWidth), float(y - halfHeight)) * texel;
            vec3 samp = texture(u_image, uv + offset).rgb;
            accum += samp * u_kernel[k];
            k++;
        }
    }
    vec3 base = texture(u_image, uv).rgb;
    outColor = vec4(blendWithColorSpace(base, accum, u_blendamount), 1.0);
}

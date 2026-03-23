#version 300 es

precision mediump float;

#include "colorconvert.glsl"

uniform sampler2D u_image;
uniform float u_scales[4];
uniform float u_offsets[4];
uniform vec2 u_resolution;
out vec4 outColor;

#define CLIPMODE_LUMA 0
#define CLIPMODE_CHANNELWISE 1

#ifndef CLIPMODE
#define CLIPMODE 1
#endif

void main() {
    vec4 pix = texture(u_image, gl_FragCoord.xy / u_resolution);
#if PASSTHROUGH == 1
    outColor = pix;
    return;
#else
    vec3 lin = srgb2linear(pix.rgb);
    #if CLIPMODE == CLIPMODE_LUMA
        float luma = dot(lin, vec3(0.2126, 0.7152, 0.0722));
        vec3 chroma = lin - vec3(luma);
        float lumaClipped = clamp(luma * u_scales[3] + u_offsets[3], 0.0, 1.0);
        lin = chroma + vec3(lumaClipped);
    #else
        lin.x = lin.x * u_scales[0] + u_offsets[0];
        lin.y = lin.y * u_scales[1] + u_offsets[1];
        lin.z = lin.z * u_scales[2] + u_offsets[2];
    #endif
        lin = clamp(lin, 0.0, 1.0);
        outColor = vec4(linear2srgb(lin), pix.a);
#endif
}

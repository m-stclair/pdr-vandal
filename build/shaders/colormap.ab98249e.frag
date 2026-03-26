#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform sampler2D u_cmap;
uniform float u_cmap_len;
uniform float u_blendamount;
uniform float u_reverse;
out vec4 outColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pixel = texture(u_image, uv);
    float mean = (pixel.r + pixel.g + pixel.b) / 3.0;
    mean = mean + u_reverse * (1. - 2. * mean);
    vec3 cMapped = texture(u_cmap, vec2(mean, 0.5)).rgb;
    outColor = vec4(applyBlend(pixel.rgb, cMapped, u_blendamount), pixel.a);
}

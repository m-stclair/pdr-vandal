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
    float luma = dot(pixel.rgb, vec3(0.2126, 0.7152, 0.0722));
    luma = luma + u_reverse * (1. - 2. * luma);
    vec3 cMapped = texture(u_cmap, vec2(luma, 0.5)).rgb;
    outColor = vec4(applyBlend(pixel.rgb, cMapped, u_blendamount), pixel.a);
}

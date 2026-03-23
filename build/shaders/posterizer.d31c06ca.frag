#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"
#include "posterize.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_bayer_resolution;
uniform float u_blendamount;
uniform float u_bias;
uniform float u_logbase;
uniform int u_levels;
out vec4 outColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pixel = texture(u_image, uv);
    vec3 color = extractColor(pixel.rgb);
    vec3 postColor = posterize(color, uv, u_bayer_resolution, u_bias, u_logbase, u_levels);
    vec3 srgbOut = encodeColor(postColor);
    outColor = vec4(applyBlend(pixel.rgb, srgbOut, u_blendamount), pixel.a);
}

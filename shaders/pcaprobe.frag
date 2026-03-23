#version 300 es
precision highp float;

uniform float u_proberes;
uniform sampler2D u_image;
out vec4 data;

#include "colorconvert.glsl"

void main() {
    vec2 uv = (gl_FragCoord.xy + 0.5) / vec2(float(u_proberes));
    vec3 srgb = texture(u_image, uv).rgb;
    vec3 lin = srgb2linear(srgb);
    data = vec4(rgb2jzazbz(lin), 0.0);
}

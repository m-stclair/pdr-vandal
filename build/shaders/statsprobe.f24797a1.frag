#version 300 es
precision highp float;

#include "colorconvert.glsl"

uniform float u_proberes;
uniform sampler2D u_image;
out vec4 data;


void main() {
    vec2 uv = (gl_FragCoord.xy + 0.5) / vec2(float(u_proberes));
    vec3 color = srgb2linear(texture(u_image, uv).rgb);
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    data = vec4(color, luma);
}

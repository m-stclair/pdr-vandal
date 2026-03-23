#version 300 es

precision mediump float;

#include "colorconvert.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_invert0;
uniform float u_invert1;
uniform float u_invert2;

out vec4 outColor;

float invert(float v, float enable) {
    return mix(v, 1. - v, enable);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pixel = texture(u_image, uv);
    vec3 color = extractColor(pixel.rgb);
    vec3 inverted = vec3(
        invert(color.x, u_invert0),
        invert(color.y, u_invert1),
        invert(color.z, u_invert2)
    );
    outColor = vec4(encodeColor(inverted), pixel.a);
}
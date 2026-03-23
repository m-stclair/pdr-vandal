#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform vec3 u_mix1;
uniform vec3 u_mix2;
uniform vec3 u_mix3;
uniform vec3 u_offset;
out vec4 outColor;

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pixel = texture(u_image, uv);
    vec3 color = extractColor(pixel.rgb);
    float c1 = dot(color, u_mix1) + u_offset.r;
    float c2 = dot(color, u_mix2) + u_offset.g;
    float c3 = dot(color, u_mix3) + u_offset.b;
    vec3 outpix = encodeColor(vec3(c1, c2, c3));
    outColor = vec4(clamp(outpix, 0.0, 1.0), pixel.a);
}

#version 300 es

precision mediump float;

#include "colorconvert.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_graypoint;
out vec4 outColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);
    vec3 lin = srgb2linear(pix.rgb);
    lin = (lin - u_graypoint) * u_contrast + u_graypoint + u_brightness;
    // fake Lab-style saturation
    float luma = dot(lin, vec3(0.2126, 0.7152, 0.0722));
    vec3 delta = lin - vec3(luma);
    lin = vec3(luma) + delta * u_saturation;
    outColor = vec4(linear2srgb(lin), pix.a);
}
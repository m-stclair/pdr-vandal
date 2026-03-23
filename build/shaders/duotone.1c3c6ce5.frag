# version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

// these are in normalized Lab
uniform vec3 u_darkColor;
uniform vec3 u_lightColor;

uniform float u_shadowPoint;
uniform float u_highlightPoint;
uniform float u_gamma;
uniform float u_blendAmount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 srgbIn = texture(u_image, uv).rgb;
    float luma = srgb2NormLab(srgbIn).x;
    luma = pow(luma, u_gamma);
    luma = smoothstep(u_shadowPoint, u_highlightPoint, luma);
    vec3 mixed = mix(u_darkColor, u_lightColor, luma);
    outColor = vec4(blendWithColorSpace(srgbIn, normLab2SRGB(mixed), u_blendAmount), 1.0);
}

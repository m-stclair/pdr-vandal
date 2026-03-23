#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_target;
uniform float u_width;
uniform float u_blendamount;

out vec4 outColor;

#define THRESHOLD_LUMA 0
#define THRESHOLD_LUMA_KEY 1
#define THRESHOLD_CHROMA_KEY 2
#define THRESHOLD_HUE_KEY 3

#define BINARIZE_NO 0
#define BINARIZE_YES 1

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 inColor = texture(u_image, uv).rgb;
    vec3 lch = srgb2NormLCH(inColor);
    bool pass;
    vec3 threshVal;

#if THRESHOLD_MODE == THRESHOLD_LUMA
    pass = lch.x > u_target;
#elif THRESHOLD_MODE == THRESHOLD_LUMA_KEY
    pass = abs(lch.x - u_target) < u_width;
#elif THRESHOLD_MODE == THRESHOLD_CHROMA_KEY
    pass = abs(lch.y - u_target) < u_width;
#elif THRESHOLD_MODE == THRESHOLD_HUE_KEY
    pass = abs(mod(lch.x - u_target, 0.5)) < u_width;
#else
    pass = false;
#endif
#if FLIP == 1
    pass = !pass;
#endif
    if (pass) {
#if BINARIZE == BINARIZE_NO
    threshVal = inColor;
#elif BINARIZE == BINARIZE_YES
    threshVal = vec3(1.0, 1.0, 1.0);
#else
    threshVal = inColor;
#endif
    } else {
        threshVal = vec3(0.0, 0.0, 0.0);
    }
    vec3 blended = blendWithColorSpace(inColor, threshVal, u_blendamount);
    outColor = vec4(clamp(blended, 0.0, 1.0), 1.0);
}
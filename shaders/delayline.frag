#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform mat2 u_transformMatrix;
const int MAX_TAPS = 256;
uniform int u_numTaps;
uniform vec2 u_offsets[MAX_TAPS];
uniform float u_weights[MAX_TAPS];
uniform float u_blendamount;

out vec4 outColor;

void main() {
    vec2 uv = (gl_FragCoord.xy + vec2(0.5)) / u_resolution;
    vec4 acc = vec4(0.0);
    float totalWeight = 0.0;
    for (int i = 0; i < MAX_TAPS; i++) {
        if (i >= u_numTaps) break;
        vec2 offset = floor(u_transformMatrix * u_offsets[i]) / u_resolution;
        vec4 samp = texture(u_image, uv + offset);
        float w = u_weights[i];
        acc += samp * w;
        totalWeight += w;
    }
    vec4 pix = texture(u_image, uv);
    vec4 delayed = totalWeight > 0.0 ? acc / totalWeight : vec4(0.0);
    outColor = vec4(blendWithColorSpace(pix.rgb, delayed.rgb, u_blendamount), pix.a);
}

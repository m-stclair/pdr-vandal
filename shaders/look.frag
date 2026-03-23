#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_exposure;
uniform float u_chroma_weight;
uniform float u_chroma_fade_low;
uniform float u_chroma_fade_high;
uniform float u_shoulder;
uniform float u_center;
uniform float u_curve_strength;
uniform vec3 u_tint;
uniform float u_tint_strength;
uniform float u_lift;
uniform float u_gamma;
uniform float u_gain;

const float sLow = 0.18;
const float sHigh = 0.35;
const float hLow = 0.65;
const float hHigh = 0.8;

out vec4 outColor;

#include "colorconvert.glsl"

// Prevent log2 from going negative infinity
float safeLog2(float x) {
    return log2(max(x, 1e-6));
}

float applyLiftGammaGain(float L, float lift, float gamma, float gain) {

    // Weight zones with smooth masks
    float shadow = 1.0 - smoothstep(sLow, sHigh, L);
    float mid = smoothstep(sLow, sHigh, L) * (1.0 - smoothstep(hLow, hHigh, L));
    float highlight = smoothstep(hLow, hHigh, L);
    // Add weighted per-zone biases
    float delta = lift * shadow + gamma * mid + gain * highlight;
    return clamp(L + delta, 0.0, 1.0);  // Clamp to stay sane
}


vec3 applyLook(vec3 srgb) {
    vec3 lch = srgb2NormLCH(srgb);

    lch.x *= exp2(u_exposure);

    float luma = lch.x;
    float chroma = lch.y;
    float hue = lch.z;

    vec2 ab = chroma * vec2(cos(hue), sin(hue));

    float tone_base = applyLiftGammaGain(luma, u_lift, u_gamma, u_gain);

    float logL = log2(max(tone_base, 1e-6));
    float curve = 1.0 / (1.0 + exp(-u_shoulder * (logL - u_center)));
    float tone = mix(tone_base, curve, u_curve_strength);

    float chroma_fade = smoothstep(u_chroma_fade_low, u_chroma_fade_high, luma);
    float chroma_base = chroma * u_chroma_weight * chroma_fade;

    vec2 ab_base = vec2(0.0);
    if (chroma_base > 1e-5) {
        ab_base = chroma_base * normalize(ab);
    }

    float tone_ratio = clamp(logL - u_center, -2.0, 2.0);  // bipolar stop space
    float tint_lerp = tone_ratio * 0.5 + 0.5;
    vec3 tint_vec = mix(-u_tint, u_tint, tint_lerp) * u_tint_strength;

    float chroma_out = length(ab_base);
    float hue_out = atan(ab_base.y, ab_base.x);
    vec3 lch_out = vec3(tone, chroma_out, hue_out);
    vec3 rgb_out = normLCH2SRGB(lch_out) + tint_vec;
    return rgb_out;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pix = texture(u_image, uv);
    vec3 looked = applyLook(pix.rgb);
    outColor = vec4(clamp(looked, 0., 1.), pix.a);
}

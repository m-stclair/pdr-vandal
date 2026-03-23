#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_blendamount;

uniform float u_FIELD_HUE_WEIGHT;
uniform float u_FIELD_HUE_WIDTH;
uniform float u_FIELD_HUE_H;
uniform float u_FIELD_HUE_CHROMA_BOOST;

uniform float u_FIELD_CHROMA_WEIGHT;
uniform float u_FIELD_CHROMA_EXP;

uniform float u_FIELD_LIGHT_WEIGHT;
uniform float u_FIELD_LIGHT_WIDTH;
uniform float u_FIELD_LIGHT_CENTER;

uniform float u_FIELD_DOT_WEIGHT;
uniform vec3 u_FIELD_DOT_VECTOR;

uniform float u_FIELD_CHROMA_BOOST_MULT;
uniform vec3 u_FIELD_TINT_COLOR;
uniform float u_FIELD_EDGE_CENTER;
uniform float u_FIELD_EDGE_WIDTH;
uniform vec2 u_FIELD_LIGHT_DIR;
uniform float u_FIELD_LIGHT_Z;

uniform float u_FIELD_HUE_FILTER_WEIGHT;
uniform float u_FIELD_HUE1_CENTER;
uniform float u_FIELD_HUE1_WIDTH;
uniform float u_FIELD_HUE2_CENTER;
uniform float u_FIELD_HUE2_WIDTH;

uniform float u_FIELD_HUE_GRAD_WEIGHT;
uniform float u_FIELD_HUE_GRAD_CHROMA_GAMMA;

uniform float u_FIELD_SIGNAL_COMPRESSION_KNEE;

#include "colorconvert.glsl";
#include "blend.glsl"
#include "color_projection.glsl"
#include "vecfield.glsl"

#define FIELD_DISPLAY_MODE_STRENGTH 0
#define FIELD_DISPLAY_MODE_ATTENUATE 1
#define FIELD_DISPLAY_MODE_TINT 2
#define FIELD_DISPLAY_MODE_CHROMA_BOOST 3
#define FIELD_DISPLAY_MODE_HILLSHADE 4
#define FIELD_DISPLAY_MODE_EDGE 5

#ifndef FIELD_DISPLAY_MODE
#define FIELD_DISPLAY_MODE FIELD_DISPLAY_MODE_STRENGTH
#endif

out vec4 outColor;

float lightnessFalloff(vec3 lch, float centerL, float width) {
    float delta = abs(lch.x - centerL);
    return smoothstep(width, 0.0, delta);
}

float chromaField(vec3 lch, float exponent) {
    return pow(lch.y, exponent);
}

float hueAffinity(vec3 lch, float targetHue, float width, float chromaBoost) {
    float hue = lch.z;
    float chroma = lch.y;
    float delta = hue - targetHue;
    if (delta > PI)  delta -= TWO_PI;
    if (delta < -PI) delta += TWO_PI;
    return smoothstep(width, 0.0, abs(delta)) * pow(chroma, chromaBoost);
}

float hueBandpass(vec3 lch, float targetHue, float width) {
    float delta = lch.z - targetHue;
    if (delta > PI)  delta -= TWO_PI;
    if (delta < -PI) delta += TWO_PI;
    float d = abs(delta);
    return smoothstep(width, 0.0, d);
}

float lchDirectionDot(vec3 lch, vec3 dir) {
    return dot(normalize(lch), dir);
}

float angleDiff(float a, float b) {
    float d = a - b;
    return mod(d + PI, TWO_PI) - PI;
}

float applyHueFilter(vec3 lch, float h1c, float h1w, float h2c, float h2w) {
    float hue1 = smoothstep(h1w, 0.0, abs(mod(lch.z - h1c + PI, TWO_PI) - PI));
    float hue2 = smoothstep(h2w, 0.0, abs(mod(lch.z - h2c + PI, TWO_PI) - PI));
    return max(hue1, hue2);
}

float hueAt(vec2 uv) {
    return srgb2NormLCH(texture(u_image, uv).rgb).z * TWO_PI;
}

float computeHueGradMag(vec2 uv, vec3 centerLCH) {
    vec2 texel = 1.0 / u_resolution;
    const float N = 2.5;  // TODO, maybe: expose
    vec2 dx = vec2(texel.x * N, 0.0);
    vec2 dy = vec2(0.0, texel.y * N);
    float hue_dx = angleDiff(hueAt(uv + dx), hueAt(uv - dx));
    float hue_dy = angleDiff(hueAt(uv + dy), hueAt(uv - dy));
    float hueGradMag = length(vec2(hue_dx, hue_dy));
    float chromaScaled = hueGradMag * pow(centerLCH.y, u_FIELD_HUE_GRAD_CHROMA_GAMMA);
    return chromaScaled;
}

struct FieldSample {
  vec3 lch;
  vec3 srgb;
  vec2 uv;
  float signal;
  float hueRad;
};

FieldSample sampleField(vec2 uv) {
    vec3 srgb = texture(u_image, uv).rgb;
    vec3 lch = srgb2NormLCH(srgb);
    float signal = 0.0;
    signal += u_FIELD_HUE_WEIGHT * hueAffinity(lch, u_FIELD_HUE_H, u_FIELD_HUE_WIDTH,
                                               u_FIELD_HUE_CHROMA_BOOST);
    signal += u_FIELD_CHROMA_WEIGHT * chromaField(lch, u_FIELD_CHROMA_EXP);
    signal += u_FIELD_LIGHT_WEIGHT * lightnessFalloff(lch, u_FIELD_LIGHT_CENTER,
                                                      u_FIELD_LIGHT_WIDTH);
    signal += u_FIELD_DOT_WEIGHT * lchDirectionDot(lch, u_FIELD_DOT_VECTOR);
    signal += u_FIELD_HUE_FILTER_WEIGHT * applyHueFilter(lch, u_FIELD_HUE1_CENTER, u_FIELD_HUE1_WIDTH,
                                                         u_FIELD_HUE2_CENTER, u_FIELD_HUE2_WIDTH);
    signal += u_FIELD_HUE_GRAD_WEIGHT * computeHueGradMag(uv, lch);

    signal = max(signal, 0.0);
#if FIELD_SIGNAL_NORMALIZE == 1
    float norm = u_FIELD_HUE_WEIGHT + u_FIELD_CHROMA_WEIGHT + u_FIELD_LIGHT_WEIGHT
                 + u_FIELD_DOT_WEIGHT + u_FIELD_HUE_FILTER_WEIGHT;
    signal /= max(norm, 1e-5);
#endif
    signal = signal / (signal + u_FIELD_SIGNAL_COMPRESSION_KNEE); 
    return FieldSample(lch, srgb, uv, signal, lch.z * TWO_PI);

}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 inColor = texture(u_image, uv).rgb;

    vec3 lch = srgb2NormLCH(inColor);

    FieldSample samp = sampleField(uv);

    vec3 rep;
#if FIELD_DISPLAY_MODE == FIELD_DISPLAY_MODE_STRENGTH
    rep = vec3(samp.signal);
#elif FIELD_DISPLAY_MODE == FIELD_DISPLAY_MODE_ATTENUATE
    rep = vec3(samp.signal) * inColor;
#elif FIELD_DISPLAY_MODE == FIELD_DISPLAY_MODE_TINT
    rep = mix(inColor, u_FIELD_TINT_COLOR, samp.signal);

#elif FIELD_DISPLAY_MODE == FIELD_DISPLAY_MODE_CHROMA_BOOST
    samp.lch.y *= mix(1.0, 2.0, samp.signal);
    rep = normLCH2SRGB(samp.lch);

#elif FIELD_DISPLAY_MODE == FIELD_DISPLAY_MODE_HILLSHADE
    float eps = 1.0 / u_resolution.x;
    float dx = (
        sampleField(uv + vec2(eps, 0.)).signal
        - sampleField(uv - vec2(eps, 0.)).signal
    );
    float dy = (
        sampleField(uv + vec2(0., eps)).signal
        - sampleField(uv - vec2(0., eps)).signal
    );
    vec3 normal = normalize(vec3(-dx, -dy, 1.0));

    vec3 lightDir = normalize(vec3(u_FIELD_LIGHT_DIR, u_FIELD_LIGHT_Z));
    float shade = 1. - dot(normal, lightDir);
    rep = vec3(clamp(shade, 0.0, 1.0));

#elif FIELD_DISPLAY_MODE == FIELD_DISPLAY_MODE_EDGE
    float edge = smoothstep(u_FIELD_EDGE_CENTER - u_FIELD_EDGE_WIDTH, u_FIELD_EDGE_CENTER, samp.signal) -
               smoothstep(u_FIELD_EDGE_CENTER, u_FIELD_EDGE_CENTER + u_FIELD_EDGE_WIDTH, samp.signal);
    rep = vec3(edge);
#else
    outColor = vec4(1.0, 0.0, 1.0, 1.0);  // fallback for debugging
    return;

#endif
    outColor = vec4(
        blendWithColorSpace(samp.srgb, clamp(rep, 0., 1.), u_blendamount),
        1.
    );
}

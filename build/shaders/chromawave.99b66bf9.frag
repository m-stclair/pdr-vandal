#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_shiftNorm;
uniform float u_spreadNorm;
uniform float u_threshold;
uniform float u_bleed;
uniform float u_satNorm;
uniform float u_lightNorm;
uniform float u_blendamount;
uniform float u_bandingSteps;
uniform float u_duty;
uniform vec2 u_origin;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"


float modulateHueWave(float signal, float spread, float shift) {
    float t = fract(signal * spread + shift);
    float p = fract(t);  // base phase
    float duty = clamp(u_duty, 0.01, 0.99);  // safe clamp

#if WAVETYPE == 0
    // Sawtooth (asymmetric ramp)
    return (p < duty)
        ? p / duty
        : 0.0;

#elif WAVETYPE == 1
    // Triangle (skewed)
    return (p < duty)
        ? p / duty
        : (1.0 - p) / (1.0 - duty);

#elif WAVETYPE == 2
    // Sine (not duty-sensitive for now)
    return 0.5 + 0.5 * sin(6.2831853 * p);

#elif WAVETYPE == 3
    // Hard square wave with precise phase duty
    return step(duty, p);

#else
    return p;  // fallback: saw
#endif
}

float quantize(float v, float steps) {
    return floor(v * steps) / steps;
}


vec4 chromawave(vec2 uv) {
    vec3 srgb = texture(u_image, uv).rgb;
    float luma = dot(srgb, vec3(0.299, 0.587, 0.114));
    if (luma < u_threshold) {
        return vec4(
           blendWithColorSpace(srgb, vec3(0.0, 0.0, 0.0), u_blendamount), 1.
        );
    }

    vec3 inHSL = srgb2HSL(srgb);
    float hue;
    float u_spreadNorm = max(u_spreadNorm, 1e-5);

#if CHROMAWAVE_CYCLE == 0
    float signal = inHSL.x;
#elif CHROMAWAVE_CYCLE == 1
    float signal = clamp((luma - u_threshold) / (1.0 - u_threshold), 0.0, 1.0);
#else
    vec2 delta = gl_FragCoord.xy - u_origin;
    float spatialSignal;
#if SPATIAL_PATTERN == 0
    spatialSignal = length(delta);
#elif SPATIAL_PATTERN == 1
    spatialSignal = delta.x;
#elif SPATIAL_PATTERN == 2
    spatialSignal = delta.y;
#elif SPATIAL_PATTERN == 3
    spatialSignal = dot(delta, normalize(vec2(1.0, 1.0)));
#elif SPATIAL_PATTERN == 4
    spatialSignal = fract(atan(delta.y / u_spreadNorm, delta.x / u_spreadNorm)) * (delta.x + delta.y);
#elif SPATIAL_PATTERN == 5
    float scale = 100.;
    spatialSignal = (sin(delta.x / 20. / u_spreadNorm) + sin(delta.y / 20. / u_spreadNorm)) * (delta.x + delta.y);
#else
    spatialSignal = length(delta);  // fallback
#endif
    // Normalize to [0,1]
    float signal = spatialSignal / length(u_resolution);
#endif
#if WAVETYPE == 3
    float selector = modulateHueWave(signal, u_spreadNorm, u_shiftNorm);
    float base = fract(u_shiftNorm);
    float alt  = fract(base + 0.5);  // 180° complement
    hue = mix(base, alt, selector);
#else
    hue = clamp(modulateHueWave(signal, u_spreadNorm, u_shiftNorm), 0.0, 0.999);
#endif

#if USE_BANDING == 1
    hue = quantize(hue, u_bandingSteps + 1.);
#endif
#if CHROMAWAVE_BLEED == 1
    hue = mix(hue, inHSL.x, u_bleed);
#endif
    vec3 fx = hsl2SRGB(vec3(hue, u_satNorm, u_lightNorm));
    vec3 outRGB = blendWithColorSpace(srgb, fx, u_blendamount);
    return vec4(outRGB, 1.0);
}


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    outColor = clamp(chromawave(uv), 0., 1.);
}

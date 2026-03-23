#version 300 es

precision mediump float;

#include "noisenums.glsl"
#include "zones.glsl"
#include "colorconvert.glsl"
#include "noise.glsl"
#include "blend.glsl"
#include "psrdnoise2.glsl"
#include "classicnoise2D.glsl"
#include "cellular2D.glsl"
#include "noise2D.glsl"

uniform sampler2D u_image;
uniform sampler2D u_cmap;
uniform float u_freqx;
uniform float u_freqy;
uniform float u_seed;
uniform vec2 u_resolution;
uniform float u_uniform;
uniform float u_perlin;
uniform float u_simplex;
uniform float u_gauss;
uniform float u_brown;
uniform float u_value;
uniform float u_worley;
uniform vec3 u_tint;
uniform float u_blendamount;
uniform float u_burstTheta;
uniform float u_burstPhi;

// mask parameters
uniform vec2 u_zoneMin; // normalized [0,1]
uniform vec2 u_zoneMax; // normalized [0,1]
uniform float u_zoneSoftness; // softness scalar
uniform float u_param_a;
uniform float u_param_b;
uniform float u_warpAngle; // in radians
uniform float u_zoneAngle; // radians
uniform float u_zoneEllipseN;

// gate parameters
uniform float u_threshold;
uniform float u_cutoffHigh;
uniform float u_burstFreq;
uniform float u_burstThreshold;


out vec4 outColor;

#define GATE_NONE 0
#define GATE_SOFT 1
#define GATE_HARD 2
#define GATE_BURST 3

#define BURST_SIMPLEX 0
#define BURST_PSEUDO_PERLIN 1
#define BURST_SINUSOIDAL 2

void main() {
    vec2 uv = (gl_FragCoord.xy + vec2(0.5)) / u_resolution;
    vec2 uvs = uv + uniformNoise(u_seed);
    float xScl = uvs.x * u_freqx;
    float yScl = uvs.y * u_freqy;
    float noiseVal = 0.0;

    noiseVal += uniformNoise(uvs.x * uvs.y) * u_uniform;

    noiseVal += cnoise(vec2(xScl, yScl)) * u_perlin * 1.4;
    vec2 gradientOut = vec2(0.0, 0.0); // scratch space for periodic simplex noise algo
    noiseVal += psrdnoise(vec2(xScl, yScl), vec2(0.0), 0.0, gradientOut) * u_simplex * 1.3;
    noiseVal += gaussianNoise(vec2(xScl, yScl)) * u_gauss;
    noiseVal += brownNoise(vec2(xScl, yScl)) * u_brown;
    noiseVal += valueNoise(vec2(xScl, yScl)) * u_value;
    vec2 cellnoise = cellular(vec2(xScl, yScl)) * u_worley;
    noiseVal += (cellnoise.x + cellnoise.y) / 2.;
    noiseVal = clamp(noiseVal, 0.0, 1.0);

#if GATE_MODE != GATE_NONE

#if GATE_MODE == GATE_SOFT
    float gateVal = noiseVal;

#elif GATE_MODE == GATE_HARD
    float gateVal = 1.0;

#elif GATE_MODE == GATE_BURST
    float gateVal = 1.0;
    mat2 rot = mat2(
        cos(u_burstTheta),
        -sin(u_burstPhi),
        sin(u_burstTheta),
        cos(u_burstPhi)
    );
    vec2 burstUV = rot * (uvs * u_burstFreq);
#if BURST_MODTYPE == BURST_SIMPLEX
    float burstField = snoise(burstUV + u_seed * 7.77);

#elif BURST_MODTYPE == BURST_PSEUDO_PERLIN
    float pVecs[4];
    pVecs[0] = 1.0;
    pVecs[1] = 0.0;
    pVecs[2] = 0.0;
    pVecs[3] = 1.0;

    float fc[3] = float[](6., 15., 10.);
    float burstField = perlinNoise2D(burstUV, fc, pVecs, u_seed * 7.77).x * 2.;

#else
    vec2 sinusoid = (
        sin(burstUV * u_burstPhi * 11.) * u_burstPhi
        + cos(burstUV * burstUV * 7.) * u_burstTheta
    );
    float burstField = sinusoid.x * sinusoid.y;

#endif
#endif

#if GATE_MODE == GATE_BURST
    bool burstPass = burstField > u_burstThreshold;
#else
    bool burstPass = true;
#endif

#if USE_WINDOW == 1
    noiseVal = (noiseVal > u_threshold && noiseVal < u_cutoffHigh && burstPass)
        ? gateVal : 0.0;
#else
    noiseVal = (noiseVal > u_threshold && burstPass)
        ? gateVal : 0.0;
#endif

#endif
#if USE_CMAP == 0
    vec3 noisePx = noiseVal * u_tint;
#else
    vec3 noisePx = texture(u_cmap, vec2(clamp(noiseVal, 0.0, 1.0), 0.5)).rgb * u_tint;
#endif
    vec3 inColor = texture(u_image, uv).rgb;
#if APPLY_MASK == 1
    float maskFactor = boundedMask(
        uv,
        u_zoneMin,
        u_zoneMax,
        u_zoneSoftness,
        u_zoneAngle,
        u_zoneEllipseN
    );
    vec3 blended = blendWithColorSpace(
        inColor,
        mix(inColor, noisePx, maskFactor),
        u_blendamount
    );
#else
    vec3 blended = blendWithColorSpace(inColor, noisePx, u_blendamount);
#endif
    outColor = vec4(clamp(blended, 0.0, 1.0), texture(u_image, uv).a);
}

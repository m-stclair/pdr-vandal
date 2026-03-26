#version 300 es
precision mediump float;

out vec4 outColor;

uniform sampler2D u_image;

uniform vec2 u_hillDir;

uniform float u_rawAmount;
uniform float u_slopeAmount;
uniform float u_slamAmount;
uniform float u_hillAmount;

uniform float u_outScale;

uniform vec2 u_resolution;

#ifndef METRIC_ORD
#define METRIC_ORD 2
#endif

#define METRIC_MIN 0
#define METRIC_MANHATTAN 1
#define METRIC_EUCLIDEAN 2
#define METRIC_CHEBYSHEV 3

#define RAWSCALE 1.0
#define SLOPESCALE 4.0
#define HILLSCALE 4.0
#define SLAMSCALE 6.0

ivec2 fieldSize() {
    return textureSize(u_image, 0);
}

ivec2 uvToCoord(vec2 uv) {
    ivec2 sz = fieldSize();
    vec2 p = clamp(uv, 0.0, 1.0 - 1e-7) * vec2(sz);
    return clamp(ivec2(floor(p)), ivec2(0), sz - 1);
}

float fetchField(ivec2 p) {
    ivec2 sz = fieldSize();
    p = clamp(p, ivec2(0), sz - 1);
    vec3 texel = texelFetch(u_image, p, 0).rgb;
    return (texel.r + texel.g + texel.b) / 3.0;
}

float metricCombine(float a, float b) {

#if METRIC_ORD == METRIC_MIN
    return min(a, b);
#elif METRIC_ORD == METRIC_MANHATTAN
    return a + b;
#elif METRIC_ORD == METRIC_EUCLIDEAN
    return length(vec2(a, b));
#elif METRIC_ORD == METRIC_CHEBYSHEV
    return max(a, b);
#else
    // error
    return 0.0;
#endif
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    ivec2 p = uvToCoord(uv);

    bool hasNorth1 = (p.y >= 1);
    bool hasWest1  = (p.x >= 1);
    bool hasNorth2 = (p.y >= 2);
    bool hasWest2  = (p.x >= 2);

    float c  = fetchField(p);
    float n1 = hasNorth1 ? fetchField(p + ivec2( 0, -1)) : c;
    float w1 = hasWest1  ? fetchField(p + ivec2(-1,  0)) : c;
    float n2 = hasNorth2 ? fetchField(p + ivec2( 0, -2)) : n1;
    float w2 = hasWest2  ? fetchField(p + ivec2(-2,  0)) : w1;

    float dy  = hasNorth1 ? (c  - n1) : 0.0;
    float dx  = hasWest1  ? (c  - w1) : 0.0;
    float dyPrev = hasNorth2 ? (n1 - n2) : 0.0;
    float dxPrev = hasWest2  ? (w1 - w2) : 0.0;
    float dyy = dy - dyPrev;
    float dxx = dx - dxPrev;

    float raw   = c;
    float slope = metricCombine(dy, dx);
    float slam  = metricCombine(dyy, dxx);
    float hill  = metricCombine(dy * u_hillDir.y, dx * u_hillDir.x);

    float v =
        u_rawAmount   * raw * RAWSCALE +
        u_slopeAmount * slope * SLOPESCALE +
        u_slamAmount  * slam * SLAMSCALE +
        u_hillAmount  * hill * HILLSCALE;

    float w =
        abs(u_rawAmount) +
        abs(u_slopeAmount) +
        abs(u_slamAmount) +
        abs(u_hillAmount);

    if (w > 0.0) {
        v /= w;
    }

    v = v * u_outScale;

    // output as grayscale
    outColor = vec4(v, v, v, 1.0);
}
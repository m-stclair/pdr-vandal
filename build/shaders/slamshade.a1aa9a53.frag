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
// Texture-coordinate step of one image pixel.
uniform vec2 u_pixelStep;

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

// Field value (mean of RGB), with coordinates clamped to the image.
float field(vec2 uv) {
    vec3 c = texture(u_image, clamp(uv, 0.0, 1.0)).rgb;
    return (c.r + c.g + c.b) / 3.0;
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
    // Differences over one image pixel, or over one display pixel when an
    // image pixel is smaller (zoomed out) so neighbors never coincide, then
    // rescaled to change per image pixel: slopes are the same at any zoom and
    // in a full-image export, where both steps are one texel.
    vec2 step = max(u_pixelStep, 1.0 / u_resolution);
    vec2 dist = step / u_pixelStep;   // step length in image pixels (>= 1)

    bool hasNorth1 = uv.y - step.y >= 0.0;
    bool hasWest1  = uv.x - step.x >= 0.0;
    bool hasNorth2 = uv.y - 2.0 * step.y >= 0.0;
    bool hasWest2  = uv.x - 2.0 * step.x >= 0.0;

    float c  = field(uv);
    float n1 = hasNorth1 ? field(uv - vec2(0.0, step.y)) : c;
    float w1 = hasWest1  ? field(uv - vec2(step.x, 0.0)) : c;
    float n2 = hasNorth2 ? field(uv - vec2(0.0, 2.0 * step.y)) : n1;
    float w2 = hasWest2  ? field(uv - vec2(2.0 * step.x, 0.0)) : w1;

    float dy  = hasNorth1 ? (c  - n1) / dist.y : 0.0;
    float dx  = hasWest1  ? (c  - w1) / dist.x : 0.0;
    float dyPrev = hasNorth2 ? (n1 - n2) / dist.y : 0.0;
    float dxPrev = hasWest2  ? (w1 - w2) / dist.x : 0.0;
    float dyy = (dy - dyPrev) / dist.y;
    float dxx = (dx - dxPrev) / dist.x;

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
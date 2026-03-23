#define POSTERIZE_NONE     0  // no effect
#define POSTERIZE_UNIFORM  1  // N evenly spaced levels
#define POSTERIZE_LOG      2  // log-spaced steps
#define POSTERIZE_BIAS     3  // bias toward dark or light via curve
#define POSTERIZE_BAYER    4  // 4x4 dither threshold map (optional)

#ifndef POSTERIZE_C1
#define POSTERIZE_C1 1
#endif
#ifndef POSTERIZE_C2
#define POSTERIZE_C2 1
#endif
#ifndef POSTERIZE_C3
#define POSTERIZE_C3 1
#endif

#ifndef POSTERIZE_MODE
#define POSTERIZE_MODE POSTERIZE_UNIFORM
#endif

float ditherThreshold(vec2 uv) {
    int x = int(mod(uv.x * 4.0, 4.0));
    int y = int(mod(uv.y * 4.0, 4.0));
    int index = y * 4 + x;
    float thresholds[16] = float[](
        0.0,  0.5, 0.125, 0.625,
        0.75, 0.25, 0.875, 0.375,
        0.1875, 0.6875, 0.0625, 0.5625,
        0.9375, 0.4375, 0.8125, 0.3125
    );
    return thresholds[index];
}

float _posterize(
    float val, vec2 uv, float bayerRes, float bias, float logBase, int levels
) {
#if POSTERIZE_MODE == POSTERIZE_NONE
    return val;

#elif POSTERIZE_MODE == POSTERIZE_UNIFORM
    return floor(val * float(levels)) / float(levels);

#elif POSTERIZE_MODE == POSTERIZE_LOG
    float logval = log(1.0 + (logBase - 1.0) * val) / log(logBase);
    float q = floor(logval * float(levels)) / float(levels);
    return pow(logBase, q) - logBase / logBase;

#elif POSTERIZE_MODE == POSTERIZE_BIAS
    float biased = pow(val, log(bias) / log(0.5));
    float q = floor(biased * float(levels)) / float(levels);
    return pow(q, log(0.5) / log(bias));

#elif POSTERIZE_MODE == POSTERIZE_BAYER
    float dither = ditherThreshold(uv / bayerRes);
    float d = val * float(levels) + dither;
    return floor(d) / float(levels);

#else
    return val;
#endif
}

vec3 posterize(vec3 color, vec2 uv, float bayerRes, float bias, float logBase, int levels) {
#if POSTERIZE_C1
    color.r = _posterize(color.r, uv, bayerRes, bias, logBase, levels);
#endif
#if POSTERIZE_C2
    color.g = _posterize(color.g, uv, bayerRes, bias, logBase, levels);
#endif
#if POSTERIZE_C3
    color.b = _posterize(color.b, uv, bayerRes, bias, logBase, levels);
#endif
    return color;
}

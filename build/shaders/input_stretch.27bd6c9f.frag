#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_min;
uniform float u_max;
uniform float u_stretchParam;

out vec4 outColor;

#define STRETCH_LIN 0
#define STRETCH_LOGLIKE 1
#define STRETCH_TANH 2

#ifndef STRETCH_MODE
#define STRETCH_MODE 0
#endif

vec3 logLikeScale(vec3 x, float k) {
    return ((k + 1.0) * x) / (1.0 + k * x);
}

void main() {
    float eps = 1e-20;
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 raw = texture(u_image, uv).rgb;
    bvec3 nanMask = isnan(raw);

    float denom = max(u_max - u_min, eps);
    vec3 norm = clamp((raw.rgb - u_min) / denom, 0.0, 1.0);

#if STRETCH_MODE == STRETCH_LIN
    vec4 rgb = vec4(norm, 1.0);
#elif STRETCH_MODE == STRETCH_LOGLIKE
    vec4 rgb = vec4(logLikeScale(norm, u_stretchParam), 1.0);
#elif STRETCH_MODE == STRETCH_TANH
    vec4 rgb = vec4(tanh(norm * u_stretchParam), 1.0);
#else
    // error
    outColor = vec4(1.0, 0.0, 1.0, 1.0);
    return;
#endif
    rgb.r = nanMask.r ? raw.r : rgb.r;
    rgb.g = nanMask.g ? raw.g : rgb.g;
    rgb.b = nanMask.b ? raw.b : rgb.b;
    outColor = rgb;
}

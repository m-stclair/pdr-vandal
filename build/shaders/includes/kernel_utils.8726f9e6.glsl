#ifndef KERNEL_SIZE
#define KERNEL_SIZE 9
#endif

uniform float u_kernel[KERNEL_SIZE];
uniform vec2 u_resolution;

vec3 applyKernel1D(sampler2D tex, vec2 uv, vec2 direction) {
    vec3 result = vec3(0.0);
    vec2 texelSize = direction / u_resolution;

    int halfSize = KERNEL_SIZE / 2;
    for (int i = 0; i < KERNEL_SIZE; ++i) {
        int offset = i - halfSize;
        vec2 sampleUV = uv + float(offset) * texelSize;
        result += texture(tex, sampleUV).rgb * u_kernel[i];
    }
    return result;
}

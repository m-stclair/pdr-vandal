#version 300 es
precision highp float;

// Decorrelation stretch (effects/decorrelation_stretch.js). The DCS
// transform and the final linear stretch are folded together on the CPU into
// one affine map, out = vM + b, where u_m0..u_m2 are the columns of M.
// Pixels with a non-finite channel come out NaN (masked, as in marslab).

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec3 u_m0;
uniform vec3 u_m1;
uniform vec3 u_m2;
uniform vec3 u_b;
out vec4 outColor;

#ifndef PASSTHROUGH
#define PASSTHROUGH 0
#endif

// Exponent-bits test: isnan/isinf can be optimized away by some drivers.
bool allFinite(vec3 v) {
    uvec3 e = floatBitsToUint(v) & 0x7f800000u;
    return all(notEqual(e, uvec3(0x7f800000u)));
}

void main() {
    vec4 pix = texture(u_image, gl_FragCoord.xy / u_resolution);
#if PASSTHROUGH == 1
    outColor = pix;
#else
    vec3 v = pix.rgb;
    if (!allFinite(v)) {
        outColor = vec4(vec3(uintBitsToFloat(0x7fc00000u)), pix.a);
        return;
    }
    vec3 o = vec3(dot(v, u_m0), dot(v, u_m1), dot(v, u_m2)) + u_b;
    outColor = vec4(clamp(o, 0.0, 1.0), pix.a);
#endif
}

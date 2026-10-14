#version 300 es
precision highp float;
precision highp int;

// Min/max reduction for the decorrelation stretch's joint bounds
// (effects/decorrelation_stretch.js). Each output texel folds a 4x4 block of
// the [0, u_inSize) input. On the first pass the input is ingress pixels:
// apply the DCS transform out = vT + c (u_t0..u_t2 are T's columns) and
// take the min and max over all three channels, or over channel u_channel
// alone when it is 0-2. Later passes fold earlier (min, max, valid) texels.
// Non-finite pixels are excluded.

uniform sampler2D u_image;
uniform ivec2 u_inSize;
uniform bool u_first;
uniform int u_channel;
uniform vec3 u_t0;
uniform vec3 u_t1;
uniform vec3 u_t2;
uniform vec3 u_c;
out vec4 outColor;

bool allFinite(vec3 v) {
    uvec3 e = floatBitsToUint(v) & 0x7f800000u;
    return all(notEqual(e, uvec3(0x7f800000u)));
}

void main() {
    ivec2 base = ivec2(gl_FragCoord.xy) * 4;
    float lo = 3.0e38;
    float hi = -3.0e38;
    float valid = 0.0;
    for (int dy = 0; dy < 4; dy++) {
        for (int dx = 0; dx < 4; dx++) {
            ivec2 p = base + ivec2(dx, dy);
            if (p.x >= u_inSize.x || p.y >= u_inSize.y) continue;
            vec4 s = texelFetch(u_image, p, 0);
            if (u_first) {
                if (!allFinite(s.rgb)) continue;
                vec3 o = vec3(dot(s.rgb, u_t0), dot(s.rgb, u_t1), dot(s.rgb, u_t2)) + u_c;
                if (u_channel < 0) {
                    lo = min(lo, min(o.r, min(o.g, o.b)));
                    hi = max(hi, max(o.r, max(o.g, o.b)));
                } else {
                    lo = min(lo, o[u_channel]);
                    hi = max(hi, o[u_channel]);
                }
                valid = 1.0;
            } else if (s.b > 0.0) {
                lo = min(lo, s.r);
                hi = max(hi, s.g);
                valid = 1.0;
            }
        }
    }
    outColor = vec4(lo, hi, valid, 1.0);
}

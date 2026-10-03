#version 300 es
precision highp float;
precision highp int;

// Ingress-stage demosaicking: reconstructs one channel (R, G, or B) of a raw
// Bayer-mosaic single-band source via bilinear or Malvar-He-Cutler
// interpolation, or (METHOD 2) extracts a single CFA plane at half resolution
// with no interpolation. Reads the native-resolution source with texelFetch so
// the mosaic parity is exact regardless of view zoom/pan.

#ifndef PATTERN
#define PATTERN 0
#endif
#ifndef METHOD
#define METHOD 0
#endif
#ifndef CHANNEL
#define CHANNEL 1
#endif
#ifndef PLANE
#define PLANE 2
#endif

uniform sampler2D u_source;
uniform vec2 u_center;
uniform vec2 u_viewSpan;
uniform ivec2 u_sourceSize;

in vec2 v_uv;
out vec4 outColor;

const int RED = 0;
const int GREEN = 1;
const int BLUE = 2;

// SUBSAMPLE planes; GREEN1/GREEN2 are the 1st/2nd green in raster order
const int P_RED = 0;
const int P_BLUE = 1;
const int P_GREEN1 = 2;
const int P_GREEN2 = 3;

// Malvar-He-Cutler 5x5 linear demosaicking kernels (sum to 8; divided by 8
// on use). Row-major, offsets (dx,dy) from -2..2.
const float F1[25] = float[25]( // G at R or B
    0.0, 0.0, -1.0, 0.0, 0.0,
    0.0, 0.0,  2.0, 0.0, 0.0,
   -1.0, 2.0,  4.0, 2.0, -1.0,
    0.0, 0.0,  2.0, 0.0, 0.0,
    0.0, 0.0, -1.0, 0.0, 0.0
);
const float F2[25] = float[25]( // target color is the same-row neighbor
    0.0,  0.0, 0.5, 0.0,  0.0,
    0.0, -1.0, 0.0, -1.0, 0.0,
   -1.0,  4.0, 5.0, 4.0, -1.0,
    0.0, -1.0, 0.0, -1.0, 0.0,
    0.0,  0.0, 0.5, 0.0,  0.0
);
const float F3[25] = float[25]( // target color is the same-column neighbor
    0.0, 0.0, -1.0, 0.0, 0.0,
    0.0, -1.0, 4.0, -1.0, 0.0,
    0.5, 0.0,  5.0, 0.0,  0.5,
    0.0, -1.0, 4.0, -1.0, 0.0,
    0.0, 0.0, -1.0, 0.0, 0.0
);
const float F4[25] = float[25]( // opposite-chroma diagonal
    0.0,  0.0, -1.5, 0.0,  0.0,
    0.0,  2.0,  0.0, 2.0,  0.0,
   -1.5,  0.0,  6.0, 0.0, -1.5,
    0.0,  2.0,  0.0, 2.0,  0.0,
    0.0,  0.0, -1.5, 0.0,  0.0
);

// Mirror reflection (not edge duplication) keeps Bayer parity at borders.
int reflectCoord(int c, int n) {
    if (c < 0) c = -c;
    if (c >= n) c = 2 * (n - 1) - c;
    return clamp(c, 0, n - 1);
}

float px(ivec2 c) {
    ivec2 r = ivec2(
        reflectCoord(c.x, u_sourceSize.x),
        reflectCoord(c.y, u_sourceSize.y)
    );
    return texelFetch(u_source, r, 0).r;
}

int classAt(ivec2 p) {
    int mx = p.x & 1;
    int my = p.y & 1;
#if PATTERN == 0 // RGGB
    if (my == 0) return (mx == 0) ? RED : GREEN;
    return (mx == 0) ? GREEN : BLUE;
#elif PATTERN == 1 // BGGR
    if (my == 0) return (mx == 0) ? BLUE : GREEN;
    return (mx == 0) ? GREEN : RED;
#elif PATTERN == 2 // GRBG
    if (my == 0) return (mx == 0) ? GREEN : RED;
    return (mx == 0) ? BLUE : GREEN;
#else // GBRG
    if (my == 0) return (mx == 0) ? GREEN : BLUE;
    return (mx == 0) ? RED : GREEN;
#endif
}

float applyKernel5x5(ivec2 p, float k[25]) {
    float sum = 0.0;
    int idx = 0;
    for (int dy = -2; dy <= 2; dy++) {
        for (int dx = -2; dx <= 2; dx++) {
            sum += px(p + ivec2(dx, dy)) * k[idx];
            idx++;
        }
    }
    return sum / 8.0;
}

float bilinearReconstruct(ivec2 p, int myClass, int target) {
    if (myClass == target) return px(p);
    if (target == GREEN) {
        return 0.25 * (
            px(p + ivec2(0, -1)) + px(p + ivec2(0, 1)) +
            px(p + ivec2(-1, 0)) + px(p + ivec2(1, 0))
        );
    }
    if (myClass == GREEN) {
        if (classAt(p + ivec2(-1, 0)) == target) {
            return 0.5 * (px(p + ivec2(-1, 0)) + px(p + ivec2(1, 0)));
        }
        return 0.5 * (px(p + ivec2(0, -1)) + px(p + ivec2(0, 1)));
    }
    return 0.25 * (
        px(p + ivec2(-1, -1)) + px(p + ivec2(1, -1)) +
        px(p + ivec2(-1, 1)) + px(p + ivec2(1, 1))
    );
}

float malvarReconstruct(ivec2 p, int myClass, int target) {
    if (myClass == target) return px(p);
    if (target == GREEN) return applyKernel5x5(p, F1);
    if (myClass == GREEN) {
        if (classAt(p + ivec2(-1, 0)) == target) return applyKernel5x5(p, F2);
        return applyKernel5x5(p, F3);
    }
    return applyKernel5x5(p, F4);
}

// Offset of the selected plane's site within a 2x2 Bayer cell.
ivec2 planeOffset() {
    int targetClass = (PLANE == P_RED) ? RED : (PLANE == P_BLUE) ? BLUE : GREEN;
    int skip = (PLANE == P_GREEN2) ? 1 : 0;
    for (int i = 0; i < 4; i++) {
        ivec2 o = ivec2(i & 1, i >> 1);
        if (classAt(o) == targetClass) {
            if (skip == 0) return o;
            skip--;
        }
    }
    return ivec2(0);
}

void main() {
    vec2 srcUV = clamp(u_center + (v_uv - 0.5) * u_viewSpan, 0.0, 1.0);
    float v;
#if METHOD == 2
    ivec2 halfSize = u_sourceSize / 2;
    ivec2 cp = clamp(
        ivec2(floor(srcUV * vec2(halfSize))), ivec2(0), halfSize - 1
    );
    v = px(cp * 2 + planeOffset());
#else
    ivec2 sp = clamp(
        ivec2(floor(srcUV * vec2(u_sourceSize))), ivec2(0), u_sourceSize - 1
    );
    int myClass = classAt(sp);
#if METHOD == 0
    v = bilinearReconstruct(sp, myClass, CHANNEL);
#else
    v = malvarReconstruct(sp, myClass, CHANNEL);
#endif
#endif
    v = clamp(v, 0.0, 1.0);
    outColor = vec4(v, v, v, 1.0);
}

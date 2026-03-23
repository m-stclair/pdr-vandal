#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_cellsize;
uniform float u_blendamount;

uniform float u_blackAngle;
uniform float u_cAngle;
uniform float u_mAngle;
uniform float u_yAngle;
uniform float u_kAngle;

uniform float u_cOffset;
uniform float u_mOffset;
uniform float u_yOffset;
uniform float u_kOffset;

out vec4 outColor;

const vec4 PLATE_C = vec4(1.0, 0.0, 0.0, 0.0);
const vec4 PLATE_M = vec4(0.0, 1.0, 0.0, 0.0);
const vec4 PLATE_Y = vec4(0.0, 0.0, 1.0, 0.0);
const vec4 PLATE_K = vec4(0.0, 0.0, 0.0, 1.0);


#define HALFTONE_BLACK 0
#define HALFTONE_CMYK  1

#ifndef HALFTONE_MODE
#define HALFTONE_MODE 0
#endif


mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// just stylized screening, not a press profile
vec4 rgbToCmyk(vec3 rgb) {
    rgb = clamp(rgb, 0.0, 1.0);

    float k = 1.0 - max(max(rgb.r, rgb.g), rgb.b);
    float denom = max(1.0 - k, 1e-5);

    float c = (1.0 - rgb.r - k) / denom;
    float m = (1.0 - rgb.g - k) / denom;
    float y = (1.0 - rgb.b - k) / denom;

    return vec4(clamp(vec3(c, m, y), 0.0, 1.0), clamp(k, 0.0, 1.0));
}

// Returns local coords inside the current halftone cell, and the UV of that cell center.
// offsetPx is in screen-pixel space, so it behaves like plate registration.
vec2 halftoneCellData(
    vec2 frag,
    float angle,
    float cellSize,
    float offsetPx,
    out vec2 cellCenterUV
) {
    // TODO, maybe: make this controllable in x/y but angle does most of it
    vec2 offset = vec2(offsetPx, offsetPx);
    vec2 pivot = 0.5 * u_resolution;
    float safeCellSize = max(cellSize, 1e-4);

    mat2 R = rot(angle);
    mat2 invR = rot(-angle);

    // Apply plate offset in screen space, then rotate into plate space.
    vec2 plateFrag = frag - offset;
    vec2 halftoneCoord = R * (plateFrag - pivot);

    vec2 cell = floor(halftoneCoord / safeCellSize);
    vec2 local = halftoneCoord - (cell + 0.5) * safeCellSize;

    vec2 cellCenterHalftoneCoord = (cell + 0.5) * safeCellSize;
    vec2 cellCenterFrag = invR * cellCenterHalftoneCoord + pivot + offset;

    cellCenterUV = clamp(cellCenterFrag / u_resolution, vec2(0.0), vec2(1.0));
    return local;
}

float halftoneDotMask(vec2 local, float cellSize, float ink) {
    float safeCellSize = max(cellSize, 1e-4);
    float dist = length(local);
    float maxR = 0.5 * safeCellSize * 0.95;
    float r = clamp(ink, 0.0, 1.0) * maxR;
    float aa = max(fwidth(dist), 1e-4);
    return 1.0 - smoothstep(r - aa, r + aa, dist);
}

float samplePlateMask(
    vec2 frag,
    float angle,
    float offsetPx,
    vec4 plateSelector
) {
    vec2 cellCenterUV;
    vec2 local = halftoneCellData(frag, angle, u_cellsize, offsetPx, cellCenterUV);

    vec3 centerColor = texture(u_image, cellCenterUV).rgb;
    vec4 cmyk = rgbToCmyk(centerColor);
    float ink = dot(cmyk, plateSelector);

    return halftoneDotMask(local, u_cellsize, ink);
}

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = frag / u_resolution;
    vec3 inColor = texture(u_image, uv).rgb;

    vec3 halftoneResult = vec3(1.0);

#if HALFTONE_MODE == HALFTONE_BLACK

    vec2 cellCenterUV;
    vec2 local = halftoneCellData(frag, u_blackAngle, u_cellsize, 0.0, cellCenterUV);

    vec3 centerColor = texture(u_image, cellCenterUV).rgb;
    float luma = srgb2NormLab(centerColor).x;
    float ink = 1.0 - luma;

    float dotMask = halftoneDotMask(local, u_cellsize, ink);
    halftoneResult = mix(vec3(1.0), vec3(0.0), dotMask);

#elif HALFTONE_MODE == HALFTONE_CMYK

    float cMask = samplePlateMask(frag, u_cAngle, u_cOffset, PLATE_C);
    float mMask = samplePlateMask(frag, u_mAngle, u_mOffset, PLATE_M);
    float yMask = samplePlateMask(frag, u_yAngle, u_yOffset, PLATE_Y);
    float kMask = samplePlateMask(frag, u_kAngle, u_kOffset, PLATE_K);

    // Simple subtractive combination:
    halftoneResult = vec3(
        (1.0 - cMask) * (1.0 - kMask),
        (1.0 - mMask) * (1.0 - kMask),
        (1.0 - yMask) * (1.0 - kMask)
    );

#endif

    vec3 blended = blendWithColorSpace(inColor, halftoneResult, u_blendamount);
    outColor = vec4(clamp(blended, 0.0, 1.0), 1.0);
}
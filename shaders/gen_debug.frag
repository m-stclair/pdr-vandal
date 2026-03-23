#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform sampler2D u_image;
out vec4 outColor;

#define MODE_UV_GRADIENT 0
#define MODE_TEXEL_CHECKER 1
#define MODE_LINEAR_INDEX 2
#define MODE_PIXEL_GRID 3
#define MODE_CENTER_DEVIATION 4
#define MODE_OOB_NAN_HIGHLIGHT 5
#define MODE_COLOR_CHECK 6

#define COLOR_MODE_CHANNEL 0
#define COLOR_MODE_SPACE 1
#define COLOR_MODE_ROUND_TRIP 2
#define COLOR_MODE_DERIV 3
#define COLOR_MODE_CLIP 4
#define COLOR_MODE_HEAT 5


#include "colorconvert.glsl"

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    ivec2 texSize = textureSize(u_image, 0);
    vec2 pixel = uv * vec2(texSize);
    ivec2 coord = ivec2(floor(pixel));

    vec4 color = texture(u_image, uv);
    bool oob = any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)));
    bool invalid = any(isnan(color)) || any(isinf(color));

    #if DEBUG_MODE == MODE_OOB_NAN_HIGHLIGHT
    if (oob) {
        outColor = vec4(1.0, 0.0, 0.0, 1.0);// red for OOB
    } else if (invalid) {
        outColor = vec4(0.0, 1.0, 1.0, 1.0);// cyan for NaN/Inf
    } else {
        outColor = vec4(0., 0., 0., 1.);
    }

    #elif DEBUG_MODE == MODE_UV_GRADIENT
    outColor = vec4(uv, 0.0, 1.0);

    #elif DEBUG_MODE == MODE_TEXEL_CHECKER
    bool alt = (coord.x % 2 == 0) != (coord.y % 2 == 0);
    outColor = alt ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(1.0);

    #elif DEBUG_MODE == MODE_LINEAR_INDEX
    int linearIndex = coord.x + coord.y * texSize.x;
    outColor = vec4(
    float((linearIndex >> 16) & 0xFF) / 255.0,
    float((linearIndex >> 8)  & 0xFF) / 255.0,
    float((linearIndex) & 0xFF) / 255.0,
    1.0
    );

    #elif DEBUG_MODE == MODE_PIXEL_GRID
    vec2 f = fract(pixel);
    float lineWidth = 0.05;
    float grid = step(f.x, lineWidth) + step(1.0 - f.x, lineWidth) +
    step(f.y, lineWidth) + step(1.0 - f.y, lineWidth);
    grid = clamp(grid, 0.0, 1.0);
    outColor = mix(color, vec4(0.0), grid);

    #elif DEBUG_MODE == MODE_CENTER_DEVIATION
    vec2 error = abs(fract(pixel) - 0.5);
    float d = length(error);
    outColor = vec4(vec3(1.0 - d * 2.0), 1.0);

#elif DEBUG_MODE == MODE_COLOR_CHECK
    vec3 inSpace = extractColor(color.rgb);

    #if DEBUG_COLOR_MODE == COLOR_MODE_CHANNEL
        float channel = inSpace[DISPLAY_CHANNEL];
        outColor = vec4(vec3(channel), 1.0);

    #elif DEBUG_COLOR_MODE == COLOR_MODE_SPACE
        outColor = vec4(inSpace, 1.0);

    #elif DEBUG_COLOR_MODE == COLOR_MODE_ROUND_TRIP
        outColor = vec4(encodeColor(inSpace), 1.0);

    #elif DEBUG_COLOR_MODE == COLOR_MODE_DERIV
        vec3 dx = dFdx(inSpace);
        vec3 dy = dFdy(inSpace);
        float derivMag = length(dx) + length(dy);
        float edge = smoothstep(0.05, 0.2, derivMag); // tweak thresholds
        outColor = vec4(vec3(edge), 1.0); // grayscale edge strength

    #elif DEBUG_COLOR_MODE == COLOR_MODE_CLIP
        float over = max(0.0, max(inSpace.r - 1.0, max(inSpace.g - 1.0, inSpace.b - 1.0)));
        float under = max(0.0, max(-inSpace.r, max(-inSpace.g, -inSpace.b)));
        float clip = clamp(over + under, 0.0, 1.0);

        outColor = mix(vec4(inSpace, 1.0), vec4(1.0, 0.0, 1.0, 1.0), clip); // magenta overlay
    #elif DEBUG_COLOR_MODE == COLOR_MODE_HEAT
        outColor = vec4(computeColorHeat(inSpace), 1.0);

    #endif

#else
    // no-op fallback
    outColor = color;
#endif
}

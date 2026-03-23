#version 300 es

precision mediump float;

out vec4 outColor;

uniform sampler2D u_image;
uniform vec2 u_resolution;

// Artistic controls
uniform float u_brightness;
uniform float u_contrast;
uniform float u_scale;
uniform float u_jitter;
uniform float u_inkOpacity;
uniform float u_paperOpacity;
uniform vec3 u_inkColor;
uniform vec3 u_paperColor;
uniform float u_blendAmount;
uniform float u_lineWidth;
uniform float u_lineWidthSensitivity;
uniform float u_angle;
uniform float u_lineSpacing;
uniform float u_lineSpacingSensitivity;

#include "noise.glsl"
#include "colorconvert.glsl"
#include "blend.glsl"

mat2 rot(float a)
{
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// Repeating anti-aliased line pattern in screen space.
// p: screen-space position in pixels
// angle: line direction angle
// spacing: pixels between lines
// width: line half-width in "phase space" units, usually < 0.5
// jitterFreq/jitterAmp: low-frequency wobble of the stripe coordinate
float hatchStripe(vec2 p, float angle, float spacing, float width, float jitterFreq, float jitterAmp)
{
    vec2 q = rot(angle) * p;

    // Wobble the coordinate slowly so lines are not mathematically humiliating.
    float n = valueNoise(q * jitterFreq);
    q.x += (n - 0.5) * jitterAmp * spacing;

    // Stripe coordinate: one unit per line spacing
    float x = q.x / spacing;

    // Distance to center of nearest stripe
    float phase = abs(fract(x) - 0.5);

    // Anti-aliasing based on pixel footprint
    float aa = fwidth(x) * 0.5;

    // 1.0 inside line, 0.0 outside
    return 1.0 - smoothstep(width - aa, width + aa, phase);
}

// Tone-gated hatch layer.
// threshold: darkness level at which layer begins to appear
// softness: how gradually it ramps in
float hatchLayer(
    vec2 p,
    float tone,
    float angle,
    float spacing,
    float width,
    float threshold,
    float softness,
    float jitterFreq,
    float jitterAmp
){
    float line = hatchStripe(p, angle, spacing, width, jitterFreq, jitterAmp);
    float gate = smoothstep(threshold - softness, threshold + softness, tone);
    return line * gate;
}

void main()
{

    vec2 uv = gl_FragCoord.xy / u_resolution;

    vec3 srgbIn = texture(u_image, uv).rgb;

    // Tone extraction
    float luma = srgb2NormLab(srgbIn).x;
    luma = (luma - 0.5) * u_contrast + 0.5;
    luma *= u_brightness;
    luma = clamp(luma, 0.0, 1.0);

    float tone = 1.0 - luma; // 0 = white, 1 = black

    // Work in pixel space so the hatch is stable on screen
    vec2 p = gl_FragCoord.xy * u_scale;

    // Layer design:
    // - Light shadows: sparse single hatch
    // - Midtones: add second direction
    // - Darker regions: add denser hatches
    // - Near-black: add a fine pass
    //
    // Using distinct thresholds is much more persuasive than trying to
    // continuously vary one lonely stripe field forever.

    float ink = 0.0;
    float widthRange = u_lineWidth * u_lineWidthSensitivity;
    float baseWidth = mix(u_lineWidth - widthRange, u_lineWidth + widthRange, tone);
    float spacingRange = u_lineSpacing * u_lineSpacingSensitivity;
    float baseSpacing = mix(u_lineSpacing - spacingRange, u_lineSpacing + spacingRange, smoothstep(0.1, 0.95, tone));

    // Layer 1: sparse
    ink += hatchLayer(
        p,
        tone,
        radians(u_angle),
        baseSpacing,    // spacing in pixels
        baseWidth,    // line half-width in phase units
        0.18,    // threshold
        0.05,    // softness
        0.030,   // jitter frequency
        u_jitter
    );

    // Layer 2: sparse
    ink += hatchLayer(
        p,
        tone,
        radians(-u_angle),
        baseSpacing,
        baseWidth,
        0.38,
        0.05,
        0.032,
        u_jitter
    );

    // Layer 3: denser
    ink += hatchLayer(
        p, tone,
        radians(u_angle),
        baseSpacing * 0.55,
        baseWidth * 0.8,
        0.58,
        0.05,
        0.040,
        u_jitter * 0.8
    );

    // Layer 4: denser
    ink += hatchLayer(
        p, tone,
        radians(-u_angle),
        baseSpacing * 0.55,
        baseWidth * 0.8,
        0.72,
        0.05,
        0.042,
        u_jitter * 0.8
    );

    // Layer 5: near-black tightening pass, slightly different angle
    ink += hatchLayer(
        p, tone,
        radians(0.0),
        7.0,
        0.07,
        0.86,
        0.04,
        0.060,
        u_jitter * 0.5
    );

    // "Paper" can either be the original image, a flat paper tone,
    // or something between. This keeps the effect usable as either
    // an overlay or a full stylization pass.
    vec3 paper = mix(srgbIn, u_paperColor, u_paperOpacity);


    // Normalize / compress accumulated ink a bit
    ink = 1.0 - exp(-ink * 0.9);
    ink = clamp(ink, 0.0, 1.0);

    // Ink tends to be stronger in dark regions, even where no line happens.
    // This gives a bit of tone bed under the hatching.
    float darkWash = smoothstep(0.35, 1.0, tone) * 0.18;

    float finalInk = clamp(ink + darkWash, 0.0, 1.0) * u_inkOpacity;

    vec3 result = mix(paper, u_inkColor, finalInk);

    outColor = vec4(blendWithColorSpace(srgbIn, result, u_blendAmount), 1.0);
}
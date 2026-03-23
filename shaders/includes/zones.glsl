// zone mask types
#define ZONE_BOX               0
#define ZONE_VERTICAL          1
#define ZONE_SUPERELLIPSE      2
#define ZONE_HORIZONTAL        3

// ---- UTILS ----

float sstep(float edge0, float edge1, float x) {
    float eps = 1e-5;
    return smoothstep(edge0, edge1 + eps, x);
}

// ---- MAIN MASK FUNCTION ----
float boundedMask(
    vec2 uv,
    vec2 zoneMin,
    vec2 zoneMax,
    float zoneSoftness,
    float zoneAngle,
    float ellipseN
) {
    vec2 center = (zoneMin + zoneMax) * 0.5;
    vec2 offset = uv - center;

    float ca = cos(-zoneAngle);
    float sa = sin(-zoneAngle);
    mat2 rot = mat2(ca, -sa, sa, ca);

    // rotate UV around center
    vec2 uv_rot = rot * offset + center;
    float softness = max(zoneSoftness, 1e-5);// clamp to avoid degenerate soft edges

#if ZONESHAPE == ZONE_BOX
    vec2 inner = vec2(
        sstep(zoneMin.x, zoneMin.x + softness / 2., uv_rot.x),
        sstep(zoneMin.y, zoneMin.y + softness / 2., uv_rot.y)
    );
    vec2 outer = vec2(
        1.0 - sstep(zoneMax.x - softness / 2., zoneMax.x, uv_rot.x),
        1.0 - sstep(zoneMax.y - softness / 2., zoneMax.y, uv_rot.y)
    );
    return inner.x * inner.y * outer.x * outer.y;

#elif ZONESHAPE == ZONE_VERTICAL
    float left = sstep(zoneMin.x, zoneMin.x + softness / 2., uv_rot.x);
    float right = 1.0 - sstep(zoneMax.x - softness / 2., zoneMax.x, uv_rot.x);
    return left * right;

#elif ZONESHAPE == ZONE_SUPERELLIPSE
    // uv_rot: your coordinates after rotation so that major/minor axes align with X/Y
    // zoneMin, zoneMax: the min/max bounds of your major/minor axes in that space
    //   → center = (zoneMin+zoneMax)/2, semi-axes = (zoneMax-zoneMin)/2
    // n: superellipse exponent (2 = true ellipse, 4 = squarer, ↑∞ → perfect rect)
    // softness: half-width of the smooth transition around the boundary
    // compute center & semi-axes
    float n = ellipseN;  // shorthand
    vec2 eCenter = 0.5 * (zoneMin + zoneMax);
    vec2 axes   = 0.5 * (zoneMax - zoneMin);
    // normalize coords to “unit” superellipse
    vec2 d = (uv_rot - eCenter) / axes;

    // superellipse implicit function: |x|^n + |y|^n = 1
    float f = pow(abs(d.x), n) + pow(abs(d.y), n);

    // smooth inside→outside across [1-softness, 1+softness]
    // smoothstep(edge0, edge1, x): 0 for x≤edge0, 1 for x≥edge1
    // so 1.0 - smoothstep gives 1 inside, 0 outside
    return 1.0 - smoothstep(
        1.0 - softness,
        1.0 + softness,
        f
    );

#elif ZONESHAPE == ZONE_HORIZONTAL
    float top = sstep(zoneMin.y, zoneMin.y + softness / 2., uv_rot.y);
    float bottom = 1.0 - sstep(zoneMax.y - softness / 2., zoneMax.y, uv_rot.y);
    return top * bottom;
#else
    return 0.0;
#endif
}

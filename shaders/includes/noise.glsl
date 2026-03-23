float hash(float x, float y, float seed) {
    return fract(sin(dot(vec2(x, y), vec2(12.9898, 78.233)) * seed));
}

float hash(float x, float seed) {
    return fract(sin(x * 12.9898 + 78.223) * seed);
}

float uniformNoise(vec2 xy) {
    return fract(sin(xy.x * xy.y * 12.9898 + 78.233) * 43758.5453);
}

float uniformNoise(float x) {
    return fract(sin(x * 12.9898 + 78.233) * 43758.5453);
}

vec2 hash2d_uv(vec2 uv) {
    // Large irrational multipliers reduce grid alignment
    const vec2 k = vec2(127.1, 311.7);
    float n = sin(dot(uv, k)) * 43758.5453;
    return fract(vec2(n, n * 1.2154));
}

vec2 grad(float ix, float iy, float seed) {
    float h = hash(ix, iy, seed);
    float angle = h * 6.2831853;
    return vec2(cos(angle), sin(angle));
}

float grad(float ix, float seed) {
    float h = hash(ix, seed);
    return cos(h * 6.2831853);
}


float dotGradient(float ix, float iy, float x, float y, float seed) {
    vec2 gradient = grad(ix, iy, seed);
    vec2 distance = vec2(x - ix, y - iy);
    return dot(gradient, distance);
}

float dotGradient(float ix, float x, float seed) {
    float gradient = grad(ix, seed);
    float distance = x - ix;// Only in 1D
    return gradient * distance;// No need for a full dot product
}

vec2 fade(vec2 t, float fc[3]) {
    return t * t * t * (t * (t * fc[0] - fc[1]) + fc[2]);
}

float fade(float t, float fc[3]) {
    return t * t * t * (t * (t * fc[0] - fc[1]) + fc[2]);
}

float lerp(float a, float b, float t) {
    return a + t * (b - a);
}

vec2 perlinBlocks(
    vec2 uv,
    float fadeCoeffs[3],
    float vecs[4],
    float seed
) {
    vec2 x0 = vec2(floor(uv.x), floor(uv.y));
    vec2 dxy = uv - vec2(float(x0.x), float(x0.y));
    vec2 fadeXY = fade(dxy, fadeCoeffs);
    float dot00 = dotGradient(x0.x, x0.y, uv.x, uv.y, seed);
    float dot10 = dotGradient(x0.x + vecs[0], x0.y, uv.x, uv.y, seed);
    float dot01 = dotGradient(x0.x, x0.y + vecs[1], uv.x, uv.y, seed);
    float dot11 = dotGradient(x0.x + vecs[2], x0.y + vecs[3], uv.x, uv.y, seed);

    float interpolatedX0 = lerp(dot00, dot10, fadeXY.x);
    float interpolatedX1 = lerp(dot01, dot11, fadeXY.x);
    float interpolatedX = lerp(interpolatedX0, interpolatedX1, fadeXY.y);

    float interpolatedY0 = lerp(dot00, dot10, fadeXY.y);
    float interpolatedY1 = lerp(dot01, dot11, fadeXY.y);
    float interpolatedY = lerp(interpolatedY0, interpolatedY1, fadeXY.x);

    return vec2(interpolatedX, interpolatedY);
}

vec3 perlinNoise2D(
    vec2 uv,
    float fadeCoeffs[3],
    float vecs[4],
    float seed
) {
    vec2 x0 = vec2(floor(uv.x), floor(uv.y));
    vec2 dxy = uv - vec2(float(x0.x), float(x0.y));
    vec2 fadeXY = fade(dxy, fadeCoeffs);
    float dot00 = dotGradient(x0.x, x0.y, uv.x, uv.y, seed);
    float dot10 = dotGradient(x0.x + vecs[0], x0.y + vecs[1], uv.x, uv.y, seed);
    float dot01 = dotGradient(x0.x + vecs[2], x0.y + vecs[3], uv.x, uv.y, seed);
    float dot11 = dotGradient(x0.x + vecs[0] + vecs[2], x0.y + vecs[1] + vecs[3],
                              uv.x, uv.y, seed);

    float interpolatedX0 = lerp(dot00, dot10, fadeXY.x);
    float interpolatedX1 = lerp(dot01, dot11, fadeXY.x);

    return vec3(
        mix(interpolatedX0, interpolatedX1, fadeXY.y),
        dot10,
        dot01
    );
}


// Box-Muller transform to generate Gaussian noise
float gaussianNoise(vec2 p) {
    float u1 = hash(p.x, p.y);
    float u2 = hash(p.x + 1.0, p.y);
    float z0 = sqrt(-2.0 * log(u1)) * cos(2.0 * 3.14159 * u2);
    return z0;
}

// NOTE: just starts ringing way too fast
// 1/f noise function (Pink noise)
float pinkNoise(vec2 p) {
    float total = 0.0;
    float persistence = 0.5;
    float frequency = 1.0;
    float amplitude = 1.0;

    for (int i = 0; i < 4; i++) {
        total += gaussianNoise(p * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= persistence;
    }

    return total;
}

float hash(vec2 p) {
    return fract(sin(dot(p ,vec2(127.1,311.7))) * 43758.5453123);
}

float brownNoise(vec2 uv) {
    float sum = 0.0;
    float amplitude = 1.0;
    float scale = 1.0;
    float total = 0.0;

    // 1/f² weighting: each octave contributes more than the next
    for (int i = 0; i < 5; i++) {
        float n = gaussianNoise(uv * scale); // replace with your gaussianNoise(vec2) if desired
        sum += n * amplitude;
        total += amplitude;

        scale *= 0.5;      // increase frequency
        amplitude *= 2.0;  // inverse-square amplitude (≈1/f²)
    }

    return sum / total; // normalize
}

// Smoothstep interpolation
float smoothstepInterp(float a, float b, float t) {
    t = t * t * (3.0 - 2.0 * t);
    return mix(a, b, t);
}
//
//float rand(vec2 n) {
//    return fract(sin(dot(n, vec2(41.0, 289.0))) * 43758.5453);
//}

float rand(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// 2D value noise
float valueNoise(vec2 uv) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);

    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));

    float u = smoothstepInterp(a, b, f.x);
    float v = smoothstepInterp(c, d, f.x);
    return smoothstepInterp(u, v, f.y);
}

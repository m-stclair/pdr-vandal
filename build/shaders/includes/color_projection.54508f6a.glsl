// === Constants ===
const float PI = 3.141592653589793;
const float TWO_PI = 6.283185307179586;

// === Uniforms ===
uniform float u_targetHue;       // radians
uniform float u_bandwidth;       // radians
uniform int u_projectionType;    // enum: 0 = cosine, 1 = bandpass, 2 = vector
uniform vec3 u_projAxis;         // in Lab or linear RGB, normalized
uniform float u_chromaWeightExp; // optional shaping

// === Input ===
// `vec3 color` is assumed to already be in desired colorspace
// If you're operating in Lab, input `color = labColor`, chroma = length(a,b)
// If you're in RGB, chroma is computed differently.

float computeChroma(vec3 color, int colorspace) {
    if (colorspace == COLORSPACE_LAB) {
        return length(color.yz); // a,b
    } else if (colorspace == COLORSPACE_RGB) {
        float maxC = max(max(color.r, color.g), color.b);
        float minC = min(min(color.r, color.g), color.b);
        return maxC - minC;
    } else {
        return 0.0; // or error value
    }
}

// === Cosine Hue Projection ===
float cosineHueResponse(float hue, float targetHue) {
    float delta = hue - targetHue;
    return max(0.0, cos(delta));
}

// === Bandpass Hue Projection ===
float bandpassHueResponse(float hue, float targetHue, float bandwidth) {
    float d = abs(mod(hue - targetHue + PI, TWO_PI) - PI);
    return smoothstep(bandwidth, 0.0, d);
}

// === Vector Projection Response ===
float vectorColorResponse(vec3 color, vec3 axis) {
    return max(0.0, dot(normalize(color), axis));
}

// === Final Response ===
float projectColor(vec3 color, float hue, float chroma, int projType) {
    float hueAmt = 0.0;

    if (projType == 0) {
        hueAmt = cosineHueResponse(hue, u_targetHue);
    } else if (projType == 1) {
        hueAmt = bandpassHueResponse(hue, u_targetHue, u_bandwidth);
    } else if (projType == 2) {
        hueAmt = vectorColorResponse(color, u_projAxis);
    }

    float chromaWeight = pow(chroma, u_chromaWeightExp);
    return hueAmt * chromaWeight;
}

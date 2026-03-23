#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

#define MAX_PALETTE_SIZE 128


layout(std140) uniform PaletteFeatures {
    // L, C, cosH, sinH
    vec4 paletteFeatures[MAX_PALETTE_SIZE];
};

layout(std140) uniform PaletteBlock {
    // L, a, b, _unused
    vec4 paletteColors[MAX_PALETTE_SIZE];
};

uniform int u_paletteSize;
uniform int u_cycleOffset;
uniform int u_blendK;
uniform float u_softness;
uniform float u_lumaWeight;
uniform float u_chromaWeight;
uniform float u_hueWeight;
uniform float u_blendAmount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"


#define ASSIGN_NEAREST 0
#define ASSIGN_BLEND 1


bool is_finite(float x) {
    return abs(x) < 1e20;
}

float deltaE_bias_fast(vec3 lab, vec4 q) {
    float L = q[0];
    float C = q[1];
    float cosH = q[2];
    float sinH = q[3];

    float dL = lab.x - L;

    float C1 = length(lab.yz);
    float dC = C1 - C;

    vec2 u = (C1 > 1e-6) ? lab.yz / C1 : vec2(1.0, 0.0);

    float theta  = clamp(dot(u, vec2(cosH, sinH)), -1.0, 1.0);
    float hueBias = 0.5 * (C1 + C) * (1.0 - theta);

    return (
        u_lumaWeight   * abs(dL) +
        u_chromaWeight * abs(dC) +
        u_hueWeight    * abs(hueBias)
    );
}



vec3 softAssign(vec3 labColor, int cycleOffset) {
  float dist[MAX_PALETTE_SIZE];
  int index[MAX_PALETTE_SIZE];

  // Compute distances
  for (int i = 0; i < u_paletteSize; ++i) {
    dist[i] = deltaE_bias_fast(labColor, paletteFeatures[i]);
    index[i] = i;
  }

  // Partial bubble sort top K
  for (int i = 0; i < u_blendK; ++i) {
    for (int j = i + 1; j < u_paletteSize; ++j) {
      if (dist[j] < dist[i]) {
        float td = dist[i]; dist[i] = dist[j]; dist[j] = td;
        int ti = index[i]; index[i] = index[j]; index[j] = ti;
      }
    }
  }
  // Blend top K
  vec3 result = vec3(0.0);
  float totalWeight = 0.0;
  for (int i = 0; i < u_blendK; ++i) {
    float w = 1.0 / pow(dist[i] + 1e-5, u_softness); // sharper with higher softness
    result += w * paletteColors[(index[i] + cycleOffset) % u_paletteSize].rgb;
    totalWeight += w;
  }

  return result / totalWeight;
}


vec3 matchNearest(vec3 lab, int cycleOffset) {
    float minDist = 1e6;
    int best_i = 0;

    for (int i = 0; i < 256; i++) {
        if (i >= u_paletteSize) break;
        float d = deltaE_bias_fast(lab, paletteFeatures[i]);
        if (d < minDist) {
            minDist = d;
            best_i = i;
        }
    }
    return paletteColors[(best_i + cycleOffset) % u_paletteSize].rgb;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
#if SHOW_PALETTE != 0
    int idx = int(round(uv.x * float(u_paletteSize - 1)));
    vec4 pcolor = paletteColors[(idx + u_cycleOffset) % u_paletteSize];
    if (uv.y < 0.1) {
        outColor = vec4(linear2srgb(lab2rgb((pcolor.rgb))), 1.);
        return;
    }
#endif
    vec3 color = texture(u_image, uv).rgb;
    vec3 lab = rgb2lab(srgb2linear(color));
#if ASSIGNMODE == ASSIGN_BLEND
    vec3 labMapped = softAssign(lab, u_cycleOffset);
#else
    vec3 labMapped = matchNearest(lab, u_cycleOffset);
#endif
    vec3 srgbOut = linear2srgb(lab2rgb(labMapped));
    srgbOut = clamp(srgbOut, 0., 1.);
    outColor = vec4(
        blendWithColorSpace(color, srgbOut, u_blendAmount),
        1.0
    );
}
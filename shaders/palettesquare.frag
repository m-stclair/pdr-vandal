#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform mat3 u_pcaBasis;     // Columns are PC1, PC2, PC3 (normalized)
uniform mat3 u_pcaInverse;   // Optional, for reprojection
uniform int u_mode;          // 0 = full reprojection, 1 = closest, 2 = weighted
uniform bool u_softQuantize; // If true, blend instead of hard remap
uniform vec3 u_pcaMean;
uniform vec3 u_pcaStd;  // or sqrt(λ) per PC
uniform vec3 u_pcaStretch;  // or sqrt(λ) per PC
uniform vec3 u_paletteLab[40]; // Packed as normalized Lab


out vec4 outColor;

#include "colorconvert.glsl"


vec3 projectPCA(vec3 color) {
    return transpose(u_pcaBasis) * color; // projection onto orthonormal basis
}


vec3 applyPalette(vec3 pcaCoords) {
    if (u_mode == 0) {
        // Full reconstruction
        return u_pcaBasis * pcaCoords;
    }

    if (u_mode == 1) {
        // Hard remap: snap to most dominant axis
        float a = abs(pcaCoords.x);
        float b = abs(pcaCoords.y);
        float c = abs(pcaCoords.z);

        if (a > b && a > c) return u_pcaBasis[0]; // PC1
        if (b > c)           return u_pcaBasis[1]; // PC2
        return u_pcaBasis[2];                     // PC3
    }

    if (u_mode == 2) {
        // Soft blend based on magnitude
        vec3 weights = abs(pcaCoords);
        weights /= max(dot(weights, vec3(1.0)), 0.0001); // normalize

        return normalize(
            u_pcaBasis[0] * weights.x +
            u_pcaBasis[1] * weights.y +
            u_pcaBasis[2] * weights.z
        );
    }

    return vec3(0.0); // fallback
}


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    outColor = vec4(normLab2SRGB(u_paletteLab[0]), 1.);
    return;
//    vec3 lab = srgb2NormLab(texture(u_image, uv).rgb);
//    vec3 centered = lab - u_pcaMean;
//    vec3 coords = transpose(u_pcaBasis) * centered;
////    coords *= u_pcaStretch;
//    vec3 reconstructed = u_pcaBasis * coords + u_pcaMean;
//    outColor = vec4(normLab2SRGB(reconstructed), 1.);
//    return;



//    // Optionally stretch:
//    pcaCoords *= u_pcaVariance;
//    // Now reconstruct:
//    vec3 reconstructed = u_pcaBasis * pcaCoords + u_colorMean;
//    outColor = vec4(linear2srgb(reconstructed), 1.);
//    return;
////    outColor = vec4(linear2srgb(u_pcaBasis[0]), 1.);
//    if (uv.x > 0.66) {
//        outColor = vec4(linear2srgb(abs(u_pcaBasis[0])), 1.);
//    } else if (uv.x > 0.33) {
//        outColor = vec4(linear2srgb(abs(u_pcaBasis[1])), 1.);
//    } else {
//        outColor = vec4(linear2srgb(abs(u_pcaBasis[2])), 1.);
//    }
//    return;
//
//    // Assume color is linear RGB, or linearize if needed
//
//    vec3 pcaCoords = projectPCA(color);
//
//    vec3 remapped = srgb2linear(applyPalette(pcaCoords));
//
//    outColor = vec4(remapped, 1.0);
}
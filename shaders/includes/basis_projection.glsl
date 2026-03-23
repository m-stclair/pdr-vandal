// === Uniforms ===
uniform mat3 u_Basis;   // columns = basis vectors (b0 | b1 | b2)
uniform mat3 u_invBasis; // inverse matrix (precomputed in JS/CPU)

// === Forward and inverse basis transform ===
vec3 toBasis(vec3 color) {
    return u_invBasis * color;
}

vec3 fromBasis(vec3 projColor) {
    return u_Basis * projColor;
}

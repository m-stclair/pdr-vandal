struct OffsetParams {
    float gradSmoothSharpness;  // exp(-grad * k), e.g. 2.0
    float gradFade;             // strength of gradient-based damping
    float curlPush;             // strength of 90° curl displacement
    float blurWeight;           // 0 = no blur, 1 = full blur
};




// Computes scalar curl of a 2D vector field at the current fragment
// 'field' should be a function from vec2 (UV) to vec2 (e.g., a flow field)
float curl2D(vec2 uv, sampler2D fieldTex, vec2 resolution) {
    float dx = 1.0 / resolution.x;
    float dy = 1.0 / resolution.y;

    vec2 dFy_dx = (texture(fieldTex, uv + vec2(dx, 0.0)).yx -
    texture(fieldTex, uv - vec2(dx, 0.0)).yx) * 0.5;

    vec2 dFx_dy = (texture(fieldTex, uv + vec2(0.0, dy)).xy -
    texture(fieldTex, uv - vec2(0.0, dy)).xy) * 0.5;

    return dFy_dx.x - dFx_dy.y;

}



vec2 filterOffsetField(vec2 uv, vec2 offset, sampler2D tex, OffsetParams p) {
    float offsetMag = length(offset);
    if (offsetMag < 1e-4) return vec2(0.0); // no warp

    // --- Step 1: Compute Jacobian of offset field
    vec2 du = dFdx(offset);
    vec2 dv = dFdy(offset);

    float gradMag = length(du) + length(dv); // fast-and-loose
    float curl = dv.x - du.y;

    // --- Step 2: Apply gradient-based damping
    float damping = smoothstep(0.0, 1.0, gradMag * p.gradSmoothSharpness);
    vec2 dampedOffset = mix(offset, vec2(0.0), damping * p.gradFade);

    // --- Step 3: Apply curl deflection (perpendicular)
    vec2 rot90 = vec2(-dampedOffset.y, dampedOffset.x);
    vec2 curlShift = curl * rot90 * p.curlPush;

    return curlShift + dampedOffset;
}

    //    vec2 du = (offsetR - offsetC) / dx.x;
    //    vec2 dv = (offsetU - offsetC) / dy.y;
    //    float gradNorm = length(vec4(du, dv));
    //    float curl = dv.x - du.y;
    //    float div = du.x + dv.y;

    //    float gradMagV = gradNorm / (fwidth(offsetC.x) + fwidth(offsetC.y));
    //    float scale = 5. * u_warpStrength ;
    //    float vis = 0.5 + 0.5 * tanh(scale * diff.curl); // scale ≈ 2.0–10.0
    //    vec3 viz = vec3(tanh(gradMagV * u_directionStrength), tanh(scale * curl), tanh(scale * div));
    //    outColor = vec4(normLab2SRGB(viz), 1.0);

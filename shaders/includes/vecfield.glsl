struct Vec2FieldDiffs {
    vec2 du;        // ∂F / ∂x
    vec2 dv;        // ∂F / ∂y
    float curl;     // ∂v/∂x - ∂u/∂y
    float div;      // ∂u/∂x + ∂v/∂y
    float gradMag;  // ||∇u|| + ||∇v||
    float gradNorm; // sqrt(sum of squares of all 4 partials)
    float laplacian; // ∇²F as sum of ∂²u + ∂²v (approximated)
};

Vec2FieldDiffs computeVec2FieldDiffs(vec2 offset) {
    Vec2FieldDiffs d;
    d.du = dFdx(offset);
    d.dv = dFdy(offset);
    d.curl = d.dv.x - d.du.y;
    d.div  = d.du.x + d.dv.y;
    d.gradMag = length(d.du) + length(d.dv);
    d.gradNorm = length(vec4(d.du, d.dv)); // true gradient matrix norm
    d.laplacian = dFdx(d.du).x + dFdy(d.dv).y;
    return d;
}
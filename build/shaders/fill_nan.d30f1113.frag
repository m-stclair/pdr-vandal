#version 300 es
precision mediump float;

out vec4 outColor;

uniform sampler2D u_image;
uniform vec2 u_resolution;


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 color = texture(u_image, uv);
    if (any(isnan(color)) || any(isinf(color))) {
        // cyan, just like dump_browse
        outColor = vec4(0.0, 1.0, 1.0, 1.0);
    } else {
        outColor = color;
    }
}
#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec2 u_tilecount;      // how many tiles along X and Y
uniform float u_offsetamount; // 0.0 to N tiles, typically < 0.5
uniform float u_blendamount;
uniform float u_seed;

out vec4 outColor;

#include "noise.glsl"
#include "colorconvert.glsl"
#include "blend.glsl"

// simple hash based on tile ID (cheap but stable)
float tileHash(vec2 id) {
    return fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 desyncOffset(vec2 uv) {
    vec2 tileID = floor(uv * u_tilecount);
    float angle = tileHash(tileID + u_seed * 0.1) * 6.28318;
    vec2 dir = vec2(cos(angle), sin(angle));
    vec2 tileSize = 1.0 / u_tilecount;
    return uv + dir * tileSize * u_offsetamount;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 warpedUV = desyncOffset(uv);
    vec3 original = texture(u_image, uv).rgb;
    vec3 warped = texture(u_image, warpedUV).rgb;
    outColor = vec4(blendWithColorSpace(original, warped, u_blendamount), 1.0);
}
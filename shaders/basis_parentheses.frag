#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "basis_projection.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform vec3 u_mix1;
uniform vec3 u_mix2;
uniform vec3 u_mix3;
uniform vec3 u_offset;

out vec4 outColor;


#define CC_DEBUG_NONE 0
#define CC_DEBUG_COORD 1
#define CC_DEBUG_PER_CHANNEL 2
#define CC_DEBUG_PALETTE 3

#ifndef CC_DEBUG_MODE
#define CC_DEBUG_MODE CC_DEBUG_MODE_NONE
#endif

#ifndef CC_DEBUG_CHANNEL
#define CC_DEBUG_CHANNEL 0
#endif

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pixel = texture(u_image, uv);
    vec3 custom = toBasis(extractColor(pixel.rgb));
    float c1 = dot(custom, u_mix1) + u_offset.r;
    float c2 = dot(custom, u_mix2) + u_offset.g;
    float c3 = dot(custom, u_mix3) + u_offset.b;
    vec3 outpix = encodeColor(fromBasis(vec3(c1, c2, c3)));
#if CC_DEBUG_MODE == CC_DEBUG_NONE
    outColor = vec4(clamp(outpix, 0.0, 1.0), pixel.a);

// various debug behaviors
#elif CC_DEBUG_MODE == CC_DEBUG_COORD
    outColor = vec4(custom, 1.0);
#elif CC_DEBUG_MODE == CC_DEBUG_PER_CHANNEL
    vec3 axisViz = vec3(custom[CC_DEBUG_CHANNEL], 0.0, 0.0); // show only 1st axis
    outColor = vec4(axisViz, 1.0);
#elif CC_DEBUG_MODE == CC_DEBUG_PALETTE
    // TODO: won't work good for some colorspaces
    vec3 b0 = encodeColor(u_Basis[0]);
    vec3 b1 = encodeColor(u_Basis[1]);
    vec3 b2 = encodeColor(u_Basis[2]);
    if (uv.x < 0.33) {
        outColor = vec4(b0.x, b0.y, b0.z, 1.);
    } else if (uv.x < 0.66) {
        outColor = vec4(b1.x, b1.y, b1.z, 1.);
    } else {
        outColor = vec4(b2.x, b2.y, b2.z, 1.);
    }
#else
    // you messed up!
    outColor = vec4(1., 0., 1., 1.);
#endif

}

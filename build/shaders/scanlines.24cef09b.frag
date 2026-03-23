#version 300 es

precision mediump float;

#include "colorconvert.glsl"
#include "blend.glsl"

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_spacing;
uniform float u_intensity;
uniform float u_phase;
uniform float u_blendamount;

out vec4 outColor;

void main() {
    // TODO: waveforms, i.ee. or step(fract(uv.y * spacing), 0.5)
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 pixel = texture(u_image, uv);
    float line = sin((uv.y + u_phase) * u_spacing * 3.1415);
    float modulator = mix(1.0, line * 0.5 + 0.5, u_intensity);
    outColor = vec4(blendWithColorSpace(pixel.rgb, vec3(modulator), u_blendamount), pixel.a);
}
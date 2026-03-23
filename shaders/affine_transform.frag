#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform mat2 u_affine;
uniform int u_wrap;
uniform float u_blendamount;
out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

void main() {
  vec2 uv = (gl_FragCoord.xy + vec2(0.5)) / u_resolution;
  vec2 center = vec2(0.5, 0.5);
  vec2 offset = uv - center;
  vec2 transformed;
  if (bool(u_wrap)) {
    transformed = fract(u_affine * offset + center + u_offset);
  } else {
    transformed = u_affine * offset + center + u_offset;
  }
  outColor = vec4(
  clamp(
    blendWithColorSpace(
      texture(u_image, uv).rgb, texture(u_image, transformed).rgb, u_blendamount
    ),
    0.,
    1.
  ),
    1.0
);
}

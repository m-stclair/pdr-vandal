#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

out vec4 outColor;

#include "colorconvert.glsl"


void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 srgb = texture(u_image, uv).rgb;
//    vec3 srgb = pix.rgb;
//    vec3 lin = srgb2linear(srgb);
//    vec3 jchz = rgb2jchz(lin);
//    vec3 jchz = vec3(1., 1., 1.);
//    vec3 jchzn = normalizeJchz(jchz);
//    vec3 jchz2 = denormalizeJchz(jchz);
//    float epsilon = 1e-4;
//    float safeC = max(jchz2.y, epsilon);
//    vec2 ab = vec2(cos(jchz2.z), sin(jchz2.z)) * safeC;
//    vec3 jzazbz = vec3(jchz2.x, ab.x, ab.y);
    //    vec3 lino = jzazbz2rgb(jzazbz);
//    vec3 lino = jchz2rgb(jchz2);
//    vec3 srgbo = linear2srgb(lino);

//    vec3 extracted = srgb2NormJchz(srgb);
//    vec3 extracted = normalizeJchz(rgb2jchz(srgb2linear(srgb)));
//    vec3 encoded = denormalizeJchz(extracted);
//    encoded = jchz2rgb(encoded);
//    encoded = linear2srgb(encoded);
//    vec3 extracted = normalizeJchz(rgb2jchz(srgb2linear(srgb)));
    vec3 extracted = srgb2NormJchz(srgb);
    vec3 encoded = normJchz2SRGB(extracted);

    outColor = vec4(encoded.x > 0., encoded.y > 0., encoded.z > 0.0, 1.0);

//    outColor = vec4(encoded, 1.0);

}


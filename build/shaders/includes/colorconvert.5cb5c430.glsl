const float REF_X = 0.95047;
const float REF_Y = 1.00000;
const float REF_Z = 1.08883;
const float EPSILON = 0.008856;
const float KAPPA = 903.3;

float lab_f(float t) {
    return t > EPSILON ? pow(t, 1.0 / 3.0) : (KAPPA * t + 16.0) / 116.0;
}

float lab_fInv(float t) {
    float t3 = t * t * t;
    return t3 > EPSILON ? t3 : (116.0 * t - 16.0) / KAPPA;
}

// RGB/XYZ/LMS conversion matrices
const mat3 RGB_TO_XYZ = mat3(
  0.412390799, 0.357584339, 0.180480789,
  0.212639006, 0.715168679, 0.072192315,
  0.019330819, 0.119194780, 0.950532152
);
const mat3 XYZ_TO_RGB = mat3(
   3.24096994, -1.53738318, -0.49861076,
  -0.96924364,  1.87596750,  0.04155506,
   0.05563008, -0.20397696,  1.05697151
);

const mat3 XYZ_TO_LMS = mat3(
     0.41478972, -0.2015100, -0.0166008,
     0.579999,    1.120649,   0.264800,
     0.0146480,   0.0531008,  0.6684799
);

const mat3 LMS_TO_XYZ = inverse(XYZ_TO_LMS);

const mat3 LMS_P_TO_JAB = mat3(
     0.5,        3.524000,  0.199076,
     0.5,       -4.066708,  1.096799,
     0.0,        0.542708, -1.295875
);
const mat3 JAB_TO_LMS_P = inverse(LMS_P_TO_JAB);

// PQ constants (primarily for JzAzBz conversion)
const float pq_b  = 1.15;
const float pq_g  = 0.66;
const float pq_c1 = 3424.0 / 4096.0;
const float pq_c2 = 2413.0 / 128.0;
const float pq_c3 = 2392.0 / 128.0;
const float pq_n  = 2610.0 / 16384.0;
const float pq_p  = 1.7 * 2523.0 / 32.0;
const float pq_d  = -0.56;
const float pq_d0 = 1.6295499532821566e-11;

vec3 pq_encode(vec3 x) {
    vec3 num = pq_c1 + pq_c2 * pow(x, vec3(pq_n));
    vec3 den = vec3(1.0) + pq_c3 * pow(x, vec3(pq_n));
    return pow(num / den, vec3(pq_p));
}

vec3 pq_decode(vec3 x) {
    vec3 xp = pow(max(x, 1e-4), vec3(1.0 / pq_p));
    vec3 num = max(xp - pq_c1, 1e-4);
    vec3 denom = max(pq_c2 - pq_c3 * xp, 1e-4);
    return pow(num / denom, vec3(1.0 / pq_n));
}

vec3 rgb2jzazbz(vec3 rgb) {
    vec3 xyz = RGB_TO_XYZ * rgb;
    vec3 lms = XYZ_TO_LMS * xyz;
    vec3 lmsp = vec3(
      pq_b * lms.x - (pq_b - 1.0) * lms.z,
      pq_g * lms.y,
      lms.z
    );
    // Apply PQ nonlinearity
    vec3 lms_P = pq_encode(max(lmsp, vec3(1e-5)));
    vec3 jab = LMS_P_TO_JAB * lms_P;
    float iz = jab.x;
    float jz = ((1.0 + pq_d) * iz) / (1.0 + pq_d * iz) - pq_d0;

    return vec3(jz, jab.yz);
}


bool anyNaN(vec3 v) {
    return !(v.x == v.x && v.y == v.y && v.z == v.z);
}



vec3 jzazbz2rgb(vec3 jzazbz) {
    float jz = jzazbz.x;
    if (jz < 1e-5) {
        jz = 1e-5;
        jzazbz.yz = vec2(0., 0.);
    }
    float iz_unnorm = jz + pq_d0;
    float iz = iz_unnorm / (1.0 + pq_d - pq_d * iz_unnorm);
    vec3 jab = vec3(iz, jzazbz.yz);
    vec3 lms_P = JAB_TO_LMS_P * jab;
    vec3 lmsp = pq_decode(lms_P);
    vec3 lms = vec3(
      (lmsp.x + (pq_b - 1.0) * lmsp.z) / pq_b,
      lmsp.y / pq_g,
      lmsp.z
    );
    vec3 xyz = LMS_TO_XYZ * lms;
    vec3 rgb = XYZ_TO_RGB * xyz;
    // if (anyNaN(rgb) || any(lessThan(rgb, vec3(-1.0)))) {
    //    rgb = vec3(0.5);
    // }
    return rgb;
}


vec3 rgb2jchz(vec3 rgb) {
    vec3 jzazbz = rgb2jzazbz(rgb);
    float J = jzazbz.x;
    float a = jzazbz.y;
    float b = jzazbz.z;

    float C = length(vec2(a, b));
    float h = atan(b, a);
    const float TWO_PIES = 6.2831850718;
    if (h < 0.0) h += TWO_PIES;
    h = mod(h, TWO_PIES);

    return vec3(J, C, h);
}

vec3 safeRGB(vec3 rgb) {
    return clamp(rgb, vec3(0.0), vec3(1.0));
}

vec3 jchz2rgb(vec3 jchz) {
    float epsilon = 1e-4;
    vec2 ab = jchz.y * vec2(cos(jchz.z), sin(jchz.z));
    vec3 jzazbz = vec3(jchz.x, ab.x, ab.y);
    vec3 rgb = jzazbz2rgb(jzazbz);
    return safeRGB(rgb);
}


vec3 rgb2lab(vec3 rgb) {
    float x = rgb.r * 0.4124564 + rgb.g * 0.3575761 + rgb.b * 0.1804375;
    float y = rgb.r * 0.2126729 + rgb.g * 0.7151522 + rgb.b * 0.0721750;
    float z = rgb.r * 0.0193339 + rgb.g * 0.1191920 + rgb.b * 0.9503041;

    float fx = lab_f(x / REF_X);
    float fy = lab_f(y / REF_Y);
    float fz = lab_f(z / REF_Z);

    float L = 116.0 * fy - 16.0;
    float a = 500.0 * (fx - fy);
    float b = 200.0 * (fy - fz);

    return vec3(L, a, b);
}

vec3 lab2rgb(vec3 lab) {
    float fy = (lab.x + 16.0) / 116.0;
    float fx = fy + lab.y / 500.0;
    float fz = fy - lab.z / 200.0;

    float x = REF_X * lab_fInv(fx);
    float y = REF_Y * lab_fInv(fy);
    float z = REF_Z * lab_fInv(fz);

    float r = x *  3.2404542 + y * -1.5371385 + z * -0.4985314;
    float g = x * -0.9692660 + y *  1.8760108 + z *  0.0415560;
    float b = x *  0.0556434 + y * -0.2040259 + z *  1.0572252;

    return clamp(vec3(r, g, b), 0.0, 1.0);
}


vec3 rgb2hsv(vec3 c) {
    float Cmax = max(max(c.r, c.g), c.b);
    float Cmin = min(min(c.r, c.g), c.b);
    float delta = Cmax - Cmin;

    float h = 0.0;
    if (delta > 0.00001) {
        if (Cmax == c.r) {
            h = mod((c.g - c.b) / delta, 6.0);
        } else if (Cmax == c.g) {
            h = ((c.b - c.r) / delta) + 2.0;
        } else {
            h = ((c.r - c.g) / delta) + 4.0;
        }
        h /= 6.0;
    }

    float s = Cmax == 0.0 ? 0.0 : delta / Cmax;
    float v = Cmax;

    return vec3(h, s, v);
}

vec3 hsv2rgb(vec3 c) {
    float h = fract(c.x) * 6.0;
    float s = c.y;
    float v = c.z;

    float i = floor(h);
    float f = h - i;

    float p = v * (1.0 - s);
    float q = v * (1.0 - s * f);
    float t = v * (1.0 - s * (1.0 - f));

    if (i == 0.0) return vec3(v, t, p);
    if (i == 1.0) return vec3(q, v, p);
    if (i == 2.0) return vec3(p, v, t);
    if (i == 3.0) return vec3(p, q, v);
    if (i == 4.0) return vec3(t, p, v);
    return vec3(v, p, q); // i == 5.0
}


vec3 hsl2rgb(vec3 c) {
    float h = c.x, s = c.y, l = c.z;

    float a = s * min(l, 1.0 - l);
    vec3 k = vec3(0.0, 2.0/3.0, 1.0/3.0);
    vec3 p = abs(fract(h + k) * 6.0 - 3.0);
    return l - a + a * clamp(p - 1.0, 0.0, 1.0);
}

vec3 rgb2hsl(vec3 c) {
    float maxc = max(max(c.r, c.g), c.b);
    float minc = min(min(c.r, c.g), c.b);
    float delta = maxc - minc;
    float l = 0.5 * (maxc + minc);
    float s = clamp(delta / (1.0 - abs(2.0 * l - 1.0) + 1e-10), 0., 1.);
    float h = 0.0;
    if (delta > 1e-10) {
        vec3 n = (c - minc) / delta;
        h = (c.r >= maxc) ? (n.g - n.b) :
            (c.g >= maxc) ? (2.0 + n.b - n.r) :
                            (4.0 + n.r - n.g);
        h = fract(h / 6.0);
    }
    return vec3(h, s, l);
}


vec3 rgb2lch(vec3 rgb) {
    vec3 lab = rgb2lab(rgb);
    float L = lab.x;
    float a = lab.y;
    float b = lab.z;

    float C = length(lab.yz);
    float h = atan(b, a);
    if (h < 0.0) h += 2.0 * 3.14159265;

    return vec3(L, C, h);
}

vec3 lch2rgb(vec3 lch) {
    float L = lch.x;
    float C = lch.y;
    float h = lch.z;

    float a = cos(h) * C;
    float b = sin(h) * C;

    return lab2rgb(vec3(L, a, b));
}

vec3 rgb2opponent(vec3 rgb) {
    float o1 = (rgb.r + rgb.g + rgb.b) / 3.0;
    float o2 = (rgb.r - rgb.g) / sqrt(2.0);
    float o3 = (rgb.r + rgb.g - 2.0 * rgb.b) / sqrt(6.0);
    return vec3(o1, o2, o3);
}

vec3 opponent2rgb(vec3 opp) {
    float o1 = opp.x;
    float o2 = opp.y;
    float o3 = opp.z;
    float r = o1 + o2 / sqrt(2.0) + o3 / sqrt(6.0);
    float g = o1 - o2 / sqrt(2.0) + o3 / sqrt(6.0);
    float b = o1 - 2.0 * o3 / sqrt(6.0);
    return vec3(r, g, b);
}


vec3 rgb2ycbcr(vec3 rgb) {
    float y  =  0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    float cb = -0.169 * rgb.r - 0.331 * rgb.g + 0.500 * rgb.b + 0.5;
    float cr =  0.500 * rgb.r - 0.419 * rgb.g - 0.081 * rgb.b + 0.5;
    return vec3(y, cb, cr);
}

vec3 ycbcr2rgb(vec3 ycbcr) {
    float y  = ycbcr.x;
    float cb = ycbcr.y - 0.5;
    float cr = ycbcr.z - 0.5;
    float r = y + 1.402 * cr;
    float g = y - 0.344136 * cb - 0.714136 * cr;
    float b = y + 1.772 * cb;
    return vec3(r, g, b);
}


// IEC sRGB curves
vec3 srgb2linear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linear2srgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 normalizeLab(vec3 lab) {
    return vec3(lab.x / 100.0, (lab.y + 128.0) / 255.0, (lab.z + 128.0) / 255.0);
}
vec3 denormalizeLab(vec3 labn) {
    return vec3(labn.x * 100.0, labn.y * 255.0 - 128.0, labn.z * 255.0 - 128.0);
}
vec3 normalizeLCH(vec3 lch) {
    return vec3(lch.x / 100.0, lch.y / 150.0, lch.z / 6.2832);
}
vec3 denormalizeLCH(vec3 lchn) {
    return vec3(lchn.x * 100.0, lchn.y * 150.0, lchn.z * 6.2832);
}

vec3 normalizeJzazbz(vec3 jzazbz) {
    return vec3(jzazbz.x, (jzazbz.yz + 1.) / 2.);
}

vec3 denormalizeJzazbz(vec3 jzazbzn) {
    return vec3(jzazbzn.x, jzazbzn.yz * 2. - 1.);
}

vec3 normalizeJchz(vec3 jchz) {
    return vec3(jchz.x, jchz.y, jchz.z / 6.2832);
}

vec3 denormalizeJchz(vec3 jchzn) {
    return vec3(jchzn.x, jchzn.y, jchzn.z * 6.2832);
}


vec3 srgb2NormLab(vec3 srgb) {
    return normalizeLab(rgb2lab(srgb2linear(srgb)));
}
vec3 normLab2SRGB(vec3 lab) {
    return linear2srgb(lab2rgb(denormalizeLab(lab)));
}

vec3 srgb2NormLCH(vec3 srgb) {
    return normalizeLCH(rgb2lch(srgb2linear(srgb)));
}
vec3 normLCH2SRGB(vec3 lch) {
    return linear2srgb(lch2rgb(denormalizeLCH(lch)));
}

vec3 srgb2Opponent(vec3 srgb) {
    return rgb2opponent(srgb2linear(srgb));
}
vec3 opponent2SRGB(vec3 opponent) {
    return linear2srgb(opponent2rgb(opponent));
}

vec3 srgb2HSL(vec3 srgb) {
    return rgb2hsl(srgb2linear(srgb));
}

vec3 hsl2SRGB(vec3 hsl) {
    return linear2srgb(hsl2rgb(hsl));
}

vec3 srgb2NormJzazbz(vec3 srgb) {
    return normalizeJzazbz(rgb2jzazbz(srgb2linear(srgb)));
}

vec3 normJzazbz2SRGB(vec3 jzazbzn) {
    return linear2srgb(jzazbz2rgb(denormalizeJzazbz(jzazbzn)));
}

vec3 srgb2NormJchz(vec3 srgb) {
    return normalizeJchz(rgb2jchz(srgb2linear(srgb)));
}

vec3 normJchz2SRGB(vec3 jchzn) {
    return linear2srgb(jchz2rgb(denormalizeJchz(jchzn)));
}

float luminance(vec3 rgb) {
    return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

#define COLORSPACE_RGB 0
#define COLORSPACE_LAB 1
#define COLORSPACE_LCH 2
#define COLORSPACE_HSV 3
#define COLORSPACE_OPPONENT 4
#define COLORSPACE_YCBCR 5
#define COLORSPACE_HSL 6
#define COLORSPACE_JZAZBZ 7
#define COLORSPACE_JCHZ 8

#ifndef COLORSPACE
#define COLORSPACE COLORSPACE_RGB
#endif

// TODO, probably: get rid of all this bs
// TODO, dissenting: NO! MORE! USE JZAZBZ! FURTHUR!
#ifndef APPLY_CHROMA_BOOST
#define APPLY_CHROMA_BOOST 0
#endif

#if APPLY_CHROMA_BOOST == 1
uniform float u_chromaBoost;
//
vec3 applyChromaBoost(vec3 c) {
    return c;
}
#endif
//#if COLORSPACE == COLORSPACE_LCH
//    c.y *= pow(c.y, 0.2) * u_chromaBoost;
//    return c;
//#elif COLORSPACE == COLORSPACE_LAB
//    float chroma = length(c.yz);
//    vec2 chromaVec = normalize(c.yz);
//    chroma = pow(chroma, 1. / u_chromaBoost);
//    return vec3(c.x, chroma * chromaVec.y, chroma * chromaVec.x);
//#else
//    return c;
//#endif
//}
//#endif


vec3 extractColor(vec3 srgb) {
    vec3 extracted;
#if COLORSPACE == COLORSPACE_RGB
    extracted = srgb;
#elif COLORSPACE == COLORSPACE_LAB
    extracted = srgb2NormLab(srgb);
#elif COLORSPACE == COLORSPACE_HSV
    extracted = rgb2hsv(srgb);
#elif COLORSPACE == COLORSPACE_LCH
    extracted = srgb2NormLCH(srgb);
#elif COLORSPACE == COLORSPACE_OPPONENT
    extracted = srgb2Opponent(srgb);
#elif COLORSPACE == COLORSPACE_YCBCR
    extracted = rgb2ycbcr(srgb);
#elif COLORSPACE == COLORSPACE_HSL
    extracted = srgb2HSL(srgb);
#elif COLORSPACE == COLORSPACE_JZAZBZ
    extracted = srgb2NormJzazbz(srgb);
#elif COLORSPACE == COLORSPACE_JCHZ
    extracted = srgb2NormJchz(srgb);
#else
    extracted = srgb;
#endif

#if APPLY_CHROMA_BOOST == 1
    extracted = applyChromaBoost(extracted);
#endif
    return extracted;
}

vec3 encodeColor(vec3 color) {
    vec3 encoded;
#if COLORSPACE == COLORSPACE_RGB
    encoded = color;
#elif COLORSPACE == COLORSPACE_LAB
    encoded = normLab2SRGB(color);
#elif COLORSPACE == COLORSPACE_HSV
    encoded = hsv2rgb(color);
#elif COLORSPACE == COLORSPACE_LCH
    encoded = normLCH2SRGB(color);
#elif COLORSPACE == COLORSPACE_OPPONENT
    encoded = opponent2SRGB(color);
#elif COLORSPACE == COLORSPACE_YCBCR
    encoded = ycbcr2rgb(color);
#elif COLORSPACE == COLORSPACE_HSL
    encoded = hsl2SRGB(color);
#elif COLORSPACE == COLORSPACE_JZAZBZ
    encoded = normJzazbz2SRGB(color);
#elif COLORSPACE == COLORSPACE_JCHZ
    encoded = normJchz2SRGB(color);
#else
    encoded = color;
#endif
    return encoded;
}

vec3 computeColorHeat(vec3 inColor) {
    // Derivative magnitude
    vec3 dx = dFdx(inColor);
    vec3 dy = dFdy(inColor);
    float derivMag = length(dx) + length(dy);
    float edge = smoothstep(0.05, 0.2, derivMag);

    // Clipping strength
    float over = max(0.0, max(inColor.r - 1.0, max(inColor.g - 1.0, inColor.b - 1.0)));
    float under = max(0.0, max(-inColor.r, max(-inColor.g, -inColor.b)));
    float clip = smoothstep(0.0, 0.1, clamp(over + under, 0.0, 1.0));

    // Combine: red-yellow-white spectrum
    float alert = max(edge, clip);
    return mix(inColor, vec3(1.0, 1.0 - alert, 1.0 - alert), alert);
}

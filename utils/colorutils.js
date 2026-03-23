import {ColorspaceEnum} from "./glsl_enums.js";

export function hex2Rgb(hex) {
    hex = hex.replace('#', '');
    const bigint = parseInt(hex, 16);
    return [
        ((bigint >> 16) & 255) / 255,
        ((bigint >> 8) & 255) / 255,
        (bigint & 255) / 255
    ];
}

export function lerpColor(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
    ];
}

export function hsl2Rgb(h, s, l) {
    let r, g, b;

    function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    }

    if (s === 0) {
        r = g = b = l; // gray
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r, g, b];
}

export function rgb2Hsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }
    return [h, s, l];
}

export function getLuminance(r, g, b) {
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

export function rgb2Lab_A(data) {
    const labData = [];
    for (let i = 0; i < data.length; i += 4) {
        const rgb = [data[i], data[i + 1], data[i + 2]];
        labData.push(...rgb2Lab(...rgb), data[i + 3]);
    }
    return labData
}

export function lab2Rgb_A(data) {
    const rgbData = [];
    for (let i = 0; i < data.length; i += 4) {
        const lab = [data[i], data[i + 1], data[i + 2]];
        rgbData.push(...lab2Rgb(...lab), data[i + 3]);
    }
    return rgbData;
}

// Constants
const REF_X = 0.95047;
const REF_Y = 1.00000;
const REF_Z = 1.08883;

// Constants for the f(t) pivot
const EPSILON = 0.008856; // 6^3 / 29^3
const KAPPA   = 903.3;    // 24389/27
const ONE_THIRD = 1/3;
const INV_255 = 1 / 255;
const INV_100 = 1 / 100;

const FI_1 = 16/116;


function f(t) {
  const t3 = Math.cbrt(t);
  return t3 * (t > EPSILON) + ((KAPPA * t + 16) * INV_100) * (t <= EPSILON);
}

function fInv(t) {
  const t3 = t * t * t;
  return t3 * (t > 0.206893034) + ((t - FI_1) / 7.787) * (t <= 0.206893034);
}

function xyz2Lab(t) {
  return t > 0.008856 ? Math.cbrt(t) : (7.787 * t + FI_1);
}

export function lab2Xyz(t) {
  const t3 = t * t * t;
  return t3 > 0.008856 ? t3 : (t - FI_1) / 7.787;
}

// Linear RGB [0,1] -> Normalized Lab [0,1]^3
export function rgb2Lab(r, g, b) {
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

  const fx = f(x / REF_X);
  const fy = f(y / REF_Y);
  const fz = f(z / REF_Z);

  const L = 116 * fy - 16;              // [0, 100]
  const a = 500 * (fx - fy);            // ~[-128, 127]
  const b_ = 200 * (fy - fz);           // ~[-128, 127]

  return [
    L * INV_100,
    (a + 128) * INV_255,
    (b_ + 128) * INV_255
  ];
}

// Normalized Lab [0,1] -> Linear RGB [0,1]^3
export function lab2Rgb(L, a, b_) {
  const l = L * 100;
  const a_ = a * 255 - 128;
  const b__ = b_ * 255 - 128;

  const fy = (l + 16) / 116;
  const fx = fy + a_ / 500;
  const fz = fy - b__ / 200;

  const x = REF_X * fInv(fx);
  const y = REF_Y * fInv(fy);
  const z = REF_Z * fInv(fz);

  const r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
  const b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  return [r, g, b].map(v => Math.max(0, Math.min(1, v)));
}



export function rgb2Hsv(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;

    const d = max - min;
    s = max === 0 ? 0 : d / max;

    if (d === 0) {
        h = 0;
    } else {
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return [h, s, v];
}

export function hsv2Rgb(h, s, v) {
    let r, g, b;

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0:
            [r, g, b] = [v, t, p];
            break;
        case 1:
            [r, g, b] = [q, v, p];
            break;
        case 2:
            [r, g, b] = [p, v, t];
            break;
        case 3:
            [r, g, b] = [p, q, v];
            break;
        case 4:
            [r, g, b] = [t, p, v];
            break;
        case 5:
            [r, g, b] = [v, p, q];
            break;
    }

    return [r, g, b];
}

export function sRGB2Linear(channel) {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function sRGBVec2Linear(rgb) {
  return rgb.map(sRGB2Linear);
}

export function linear2SRGB(channel) {
  return channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * Math.pow(channel, 1/2.4) - 0.055;
}

function linearVec2SRGB(rgb) {
  return rgb.map(linear2SRGB);
}


// TODO: fill this out and use it consistently
export const colorSpaces = {
    rgb: {
        label: "RGB",
        to: (r, g, b) => [r, g, b],
        from: (x, y, z) => [x, y, z],
        channelLabels: ["Red", "Green", "Blue"],
    },
    hsv: {
        label: "HSV",
        to: rgb2Hsv,
        from: hsv2Rgb,
        channelLabels: ["Hue", "Saturation", "Value"],
    },
    hsl: {
        label: "HSL",
        to: rgb2Hsl,
        from: hsl2Rgb,
        channelLabels: ["Hue", "Saturation", "Lightness"],
    },
    lab: {
        label: "Lab",
        to: rgb2Lab,
        from: lab2Rgb,
        channelLabels: ["L", "a", "b"],
    },
};


// TODO: this and the previous object should not be
//  separate and contradictory
export function convertAxisVector(vec, from, to = ColorspaceEnum.Lab) {
    // TODO: ugh, this should happen at a higher level
    from = Number(from);
    to = Number(to);
    if (from === to) return vec;

    let inVec;
    if (from === ColorspaceEnum.RGB) {
        inVec = vec;
    }
    if (from === ColorspaceEnum.HSV) {
        inVec = hsv2Rgb(...vec);
    }
    if (from === ColorspaceEnum.Lab) {
        inVec = linearVec2SRGB(lab2Rgb(...vec));
    }
    if (to === ColorspaceEnum.HSV) {
        return rgb2Hsv(...inVec);
    }
    if (to === ColorspaceEnum.Lab) {
        return rgb2Lab(...sRGBVec2Linear(inVec));
    }
    if (to === ColorspaceEnum.RGB) {
        return vec
    }
    throw new Error(`No conversion from ${from} to ${to}`);
}


function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}


function hueAffinity(color, targetHueRad, widthRad = 0.3, chromaWeightExp = 1.0) {
  // Assume `color` is in Lab, with hue = atan2(b, a)
  const a = color[1];
  const b = color[2];
  const hue = Math.atan2(b, a);
  const chroma = Math.hypot(a, b);

  // Shortest angular distance
  const d = Math.abs(((hue - targetHueRad + Math.PI) % (2 * Math.PI)) - Math.PI);

  // Smooth falloff (can swap with Gaussian or raised cosine)
  const hueFalloff = smoothstep(widthRad, 0.0, d);

  // Optional chroma shaping
  const chromaWeight = Math.pow(chroma, chromaWeightExp);

  return hueFalloff * chromaWeight;
}

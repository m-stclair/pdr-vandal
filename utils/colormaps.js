import { lerpColor, hex2Rgb, hsl2Rgb } from './colorutils.js';

/** Map name → colormap function */
export const colormaps = {
  moonbow: fromList([
      "#3E055C", "#462BBC", "#2866C0", "#28A72B", "#CFB675",
      "#F9DCFC",
  ]),
  bowmoon: fromList([
      "#351D21", "#6F3812", "#766C07", "#10A737", "#96BEF6",
  ]),
  vaportrail: fromList([
      "#000000", "#210740", "#590080", "#BF5AAD", "#FF96B6",
  ]),
  neon: fromList([
      "#FF00D4", "#941212", "#000000", "#3B73F5", "#9CFCFF",
  ]),
  sunset: fromList([
    "#000000", "#001F2E", "#2B3BB8", "#CD6BF5", "#FFAD96",
  ]),
  orange_teal: fromList([
    "#FF9729", "#D07A21", "#A25E18", "#74410F", "#461506",
    "#220A03", "#000000", "#03221F", "#07443F", "#0C665F",
    "#10987F", "#14BA9F", "#18DCC0", "#1CFEE0", "#28FFF0"
  ]),
  viridis: fromList([
    "#440154", "#482777", "#3E4989", "#31688E", "#26838F",
    "#1F9E89", "#35B779", "#6DCD59", "#B4DE2C", "#FDE725"
  ]),
  gistRainbowMap(x) {
    x = x % 1; // wrap around
    const r = Math.sin(Math.PI * x) ** 2;
    const g = Math.sin(Math.PI * (x + 1/3)) ** 2;
    const b = Math.sin(Math.PI * (x + 2/3)) ** 2;
    return [r, g, b];
  },
  grayscale: (t) => [t, t, t],
  rainbow: (t) => {
    const h = (1 - t) * 0.7;
    return hsl2Rgb(h, 1, 0.5);
  },
  inferno: fromList([
    "#000004", "#1B0C41", "#4A0C6B", "#781C6D", "#A52C60",
    "#CF4446", "#ED6925", "#FB9A06", "#F7D13D", "#FCFFA4"
  ]),
  aqua_pink: fromList([
    "#00FFFF", "#3FBFBF", "#7F7F7F", "#BF3FBF", "#FF00FF"
  ]),
  glacier: fromList([
   "#f0faff", "#c0d8ef", "#90b7df", "#6087b7", "#304760", "#101720"
  ]),
  ashfall: fromList([
   "#1b1b1b", "#353535", "#505050", "#7a7a7a", "#aaaaaa"
  ]),
  blush: fromList([
    "#ffffff", "#fce4ec", "#f8bbd0", "#f48fb1", "#f06292"
  ]),
  terrain: fromList([
    "#006400", "#7FFF00", "#FFFF00", "#DAA520", "#A0522D", "#FFFFFF"
  ]),
  bone: fromList([
    "#000000", "#1e1f26", "#44485a", "#6b6e85", "#9191a9",
    "#b6b5c5", "#dad9dd", "#fefcf5"
  ]),
  cubehelix: (t) => {
    const angle = 2 * Math.PI * (0.5 + 1.5 * t);
    const amp = 0.5 * t * (1 - t); // perceptual contrast
    const r = t + amp * (-0.14861 * Math.cos(angle) + 1.78277 * Math.sin(angle));
    const g = t + amp * (-0.29227 * Math.cos(angle) - 0.90649 * Math.sin(angle));
    const b = t + amp * (1.97294 * Math.cos(angle));
    return [
      Math.min(Math.max(r, 0), 1),
      Math.min(Math.max(g, 0), 1),
      Math.min(Math.max(b, 0), 1)
    ];
  }
};

function makeLut(cmap, N) {
  const lutArr = new Uint8Array(N * 4);
  for (let c = 0; c < N; c++) {
    const [r, g, b] = cmap(c / N);
    lutArr[c * 4] = Math.round(r * 255);
    lutArr[c * 4 + 1] = Math.round(g * 255);
    lutArr[c * 4 + 2] = Math.round(b * 255);
    lutArr[c * 4 + 3] = 255;
  }
  return lutArr;
}

export const cmapLuts = {};
export const LUTSIZE = 1024;

function makeCmapTextureArray() {
  Object.entries(colormaps).forEach(([name, cmap]) => {
    cmapLuts[name] = makeLut(cmap, LUTSIZE);
  });
}

makeCmapTextureArray();

/** Build a colormap from a list of CSS color strings */
export function fromList(colorList) {
  const stops = colorList.map(hex2Rgb);
  return function(t) {
    const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
    const i = Math.floor(x);
    const frac = x - i;
    const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
    return lerpColor(a, b, frac);
  }
}


export function resampleLut(lut, method = 'nearest', nColors = 1024) {
  const N = lut.length / 4;
  const out = new Uint8ClampedArray(nColors * 4);

  for (let i = 0; i < nColors; i++) {
    const t = i / (nColors - 1);
    const pos = t * (N - 1);

    if (method === 'nearest') {
      const nearest = Math.floor(pos);
      out[i * 4] = lut[nearest * 4];
      out[i * 4 + 1] = lut[nearest * 4 + 1];
      out[i * 4 + 2] = lut[nearest * 4 + 2];
      out[i * 4 + 3] = lut[nearest * 4 + 3];

    }

    else if (method === 'linear') {
      const i0 = Math.floor(pos) * 4;
      const i1 = Math.min(i0 / 4 + 1, N - 1);
      const f = pos * 4 - i0;

      const r0 = lut[i0];
      const g0 = lut[i0 + 1];
      const b0 = lut[i0 + 2];
      const a0 = lut[i0 + 3];
      const r1 = lut[i1];
      const g1 = lut[i1 + 1];
      const b1 = lut[i1 + 2]
      const a1 = lut[i1 + 3];

      out[i * 4] = (1 - f) * r0 + f * r1;
      out[i * 4 + 1] = (1 - f) * g0 + f * g1;
      out[i * 4 + 2] = (1 - f) * b0 + f * b1;
      out[i * 4 + 3] = (1 - f) * a0 + f * a1;
    }

    else {
      throw new Error(`Unknown interpolation method: ${method}`);
    }
  }

  return out;
}
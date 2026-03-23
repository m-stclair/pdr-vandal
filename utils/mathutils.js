export const rad2deg = (rad) => rad * (180 / Math.PI);
export const deg2rad = (deg) => deg * Math.PI / 180;

export function rotationMatrix2D(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return new Float32Array([
    c, -s,
    s,  c
  ]);
}

export function scaleMatrix2D(sx, sy) {
  return new Float32Array([
    sx,  0,
     0, sy
  ]);
}

export function shearMatrix2D(shx, shy) {
  return new Float32Array([
    1, shx,
    shy, 1
  ]);
}

export function multiplyMat2(a, b) {
  const a00 = a[0], a01 = a[1],
        a10 = a[2], a11 = a[3];
  const b00 = b[0], b01 = b[1],
        b10 = b[2], b11 = b[3];

  return new Float32Array([
    a00 * b00 + a01 * b10,  a00 * b01 + a01 * b11,
    a10 * b00 + a11 * b10,  a10 * b01 + a11 * b11,
  ]);
}

export function dot3(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}


export function clamp(x, min, max) {
    if (x <= min) return min;
    if (x >= max) return max;
    return x;
}

export const clampedPositive = (func) => (...args) => Math.max(0, func(...args));


export function hist1D(data, nbins = 256, vmin = 0, vmax = 1) {
  const hist = new Uint32Array(nbins);
  const scale = nbins / (vmax - vmin + 1e-15); // match your C anti-overflow fudge
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    const ix = Math.floor((v - vmin) * scale);
    if (ix >= 0 && ix < nbins) hist[ix]++;
  }
  return hist;
}

export function val2Bin(v, vmin, scale) {
    return Math.floor((v - vmin) * scale);
}


export function genUnitVectors(orientation, spread) {
    const unitVectors = [];
    const angleIncrement = Math.PI;

    for (let i = 0; i < 2; i++) {
        const angle = orientation + (i * angleIncrement) - (Math.PI / 2);

        const spreadFactor = spread * Math.sin(angle);
        const x = Math.cos(angle) + spreadFactor;
        const y = Math.sin(angle) + spreadFactor;

        unitVectors.push(x);
        unitVectors.push(y);
    }

    return unitVectors;
}

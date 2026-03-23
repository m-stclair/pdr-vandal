// delay_kernels.js

const KERNEL_SANITY_CUTOFF = 1000 * 1000

/** Generalized kernel generator
 * shapeFn: (x, y, radius) => boolean  (includes point?)
 * options:
 *   radius: size in pixels (for circular kernels, etc.)
 *   spacing: sample spacing (default 1)
 *   maxTaps: max number of taps (optional downsampling)
 *   weightFn: function of (x / radius, y / radius) => number (default 1)
 */
export function makeKernel(shapeFn, {
  radius = 5,
  spacing = 1,
  maxTaps = Infinity,
  weightFn = () => 1
} = {}) {
  // always return identity kernel for 'invalid' radius/spacing
  if (
      !isFinite(radius) || !isFinite(spacing)
      || isNaN(radius) || isNaN(spacing)
      || radius <= 0 || spacing <= 0
  ) {
    return {taps: [[0, 0]], weights: [1]}
  }
  // do not generate kernels with more than a million elements (what are you
  // doing with this thing? you are going to crash the tab)
  if ((radius / spacing * 2) ** 2 > KERNEL_SANITY_CUTOFF) {
    throw new Error(
        `refusing to generate kernel of size ${(radius / spacing * 2) ** 2} .`
        + `If you really meant to do that, go edit KERNEL_SANITY_CUTOFF.`
    )
  }
  const taps = [];
  const weights = [];
  for (let y = -radius; y <= radius; y += spacing) {
    const ny = y / radius;
    for (let x = -radius; x <= radius; x += spacing) {
      const nx = x / radius;
      if (shapeFn(x, y, radius)) {
        taps.push([x, y]);
        weights.push(weightFn(nx, ny));
      }
    }
  }

  if (taps.length > maxTaps) {
    const stride = Math.ceil(taps.length / maxTaps);
    const keep = (arr) => arr.filter((_, i) => i % stride === 0).slice(0, maxTaps);
    return { taps: keep(taps), weights: keep(weights) };
  }

  return { taps, weights };
}



// === Standard shapes ===

export function boxKernel(size, options = {}) {
  return makeKernel(
    () => true,
    { radius: size / 2, ...options }
  );
}

export function circularKernel(radius, options = {}) {
  return makeKernel(
    (x, y, r) => x * x + y * y <= r * r,
    { radius, ...options }
  );
}

export function annularKernel(rInner, rOuter, options = {}) {
  return makeKernel(
    (x, y) => {
      const d2 = x * x + y * y;
      return d2 >= rInner * rInner && d2 <= rOuter * rOuter;
    },
    { radius: rOuter, ...options }
  );
}

export function gaussianKernel(radius, options = {}) {
  return makeKernel(
    (x, y, r) => x * x + y * y <= r * r,  // Check if within radius
    {
      radius,
      weightFn: (nx, ny) => Math.exp(-(nx * nx + ny * ny) / 2),  // Gaussian falloff
      ...options
    }
  );
}

export function diamondKernel(size, options = {}) {
  return makeKernel(
    (x, y, r) => Math.abs(x) + Math.abs(y) <= r,  // Check for diamond shape
    { radius: size / 2, ...options }
  );
}

export function hexagonalKernel(size, options = {}) {
  return makeKernel(
    (x, y) => {
      // Hexagonal grid check, no need for the unused `radius` argument
      const q = (x * Math.sqrt(3) / 2 + y) / size;
      const r = y / size;
      return Math.abs(q - Math.round(q)) < 0.5 && Math.abs(r - Math.round(r)) < 0.5;
    },
    { radius: size, ...options }
  );
}

export function spiralKernel(radius, options = {}) {
  return makeKernel(
    (x, y, r) => {
      const distance = Math.sqrt(x * x + y * y);
      const angle = Math.atan2(y, x);
      return distance <= r;  // Ensure taps fall within radius
    },
    {
      radius,
      weightFn: (nx, ny) => Math.sin(Math.atan2(ny, nx)),  // Spiral weight decay
      ...options
    }
  );
}



// === Utilities ===

export function normalizeWeights(weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => w / sum);
}

export function centerKernel(taps) {
  const n = taps.length;
  const [cx, cy] = taps.reduce(
    ([sx, sy], [x, y]) => [sx + x / n, sy + y / n],
    [0, 0]
  );
  return taps.map(([x, y]) => [x - cx, y - cy]);
}

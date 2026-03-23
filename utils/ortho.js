export class BasisConstructionError extends Error {
  constructor(message) {
    super(message);
    this.name = "BasisConstructionError";
  }
}

// Expects m as a 3x3 array-of-arrays: [ [a,b,c], [d,e,f], [g,h,i] ]
export function invertMat3(m) {
  const a = m[0][0], b = m[0][1], c = m[0][2];
  const d = m[1][0], e = m[1][1], f = m[1][2];
  const g = m[2][0], h = m[2][1], i = m[2][2];

  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;

  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-8) throw new BasisConstructionError(
      "Provided matrix is singular or unstable"
  );

  const invDet = 1 / det;

  return [
    [ A * invDet, D * invDet, G * invDet ],
    [ B * invDet, E * invDet, H * invDet ],
    [ C * invDet, F * invDet, I * invDet ]
  ];
}


export function normalize(v) {
  const len = Math.hypot(...v);
  return v.map(x => x / len);
}

export function dot(a, b) {
  return a.reduce((sum, x, i) => sum + x * b[i], 0);
}

export function subtract(a, b) {
  return a.map((x, i) => x - b[i]);
}

export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}


// Takes an array of up to 3 vectors: [[x1,y1,z1], [x2,y2,z2], ...]
// Returns 3 orthonormal basis vectors
export function gramSchmidt3(inputVectors) {
  const basis = [];

  for (let i = 0; i < inputVectors.length; i++) {
    let v = inputVectors[i].slice(); // clone

    for (let j = 0; j < basis.length; j++) {
      const b = basis[j];
      const dot = v[0]*b[0] + v[1]*b[1] + v[2]*b[2];
      v[0] -= dot * b[0];
      v[1] -= dot * b[1];
      v[2] -= dot * b[2];
    }

    const len = Math.hypot(v[0], v[1], v[2]);
    if (len < 1e-8) throw new BasisConstructionError("Degenerate basis vector");

    basis.push([ v[0]/len, v[1]/len, v[2]/len ]);
  }

  // Pad with arbitrary orthogonal vector if < 3 supplied
  while (basis.length < 3) {
    const [a, b] = basis;
    const c = [
      a[1]*b[2] - a[2]*b[1],
      a[2]*b[0] - a[0]*b[2],
      a[0]*b[1] - a[1]*b[0]
    ];
    const len = Math.hypot(c[0], c[1], c[2]);
    if (len < 1e-8) throw new BasisConstructionError("Input vectors are colinear or invalid");
    basis.push([ c[0]/len, c[1]/len, c[2]/len ]);
  }

  return basis;
}


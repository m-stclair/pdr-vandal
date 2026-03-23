/**
* @param {string} id
* @returns {HTMLElement}
*/
const gid = (id) => document.getElementById(id)

/**
 * @param {string} name
 * @returns {NodeListOf<HTMLElement>}
 */
const gen = (name) => document.getElementsByName(name)

/**
 * @param {*} obj
 * @returns {Array|*[]}
 */
const listify = function(obj) {
    if (obj instanceof Array) {
        return obj
    }
    return [obj]
}

/**
 * Create a stable string hash from an object by sorting keys.
 * @param {Record<string, any>} obj - Config subset or full config
 * @returns {string} hash key
 */
export function hashObject(obj) {
    if (typeof obj !== 'object' || obj === null) return String(obj);

    const stable = (x) => {
        if (Array.isArray(x)) {
            return `[${x.map(stable).join(',')}]`;
        } else if (typeof x === 'object' && x !== null) {
            return `{${Object.keys(x).sort().map(k => `${k}:${stable(x[k])}`).join(',')}}`;
        } else {
            return JSON.stringify(x);
        }
    };

    return stable(obj);
}

export function imageDataHash(imageData, sampleStride = 16) {
    const data = imageData.data;
    let hash = 0;

    for (let i = 0; i < data.length; i += 4 * sampleStride) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Simple bit mash
        hash ^= ((r << 24) | (g << 16) | (b << 8) | a);
        hash = (hash >>> 1) | (hash << 31); // Rotate
        hash = hash >>> 0; // Force unsigned
    }

    return hash.toString(16).padStart(8, '0');
}

const DOWNSAMPLE_LIMIT = 128;

export async function downsampleImageData(imageData, maxSize = DOWNSAMPLE_LIMIT) {
    const scale = Math.min(
        maxSize / imageData.width,
        maxSize / imageData.height,
        1 // don't upscale
    );
    const w = Math.floor(imageData.width * scale);
    const h = Math.floor(imageData.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const bitmap = await createImageBitmap(imageData);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
}


function fallbackUUIDv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8); // ensure `y` is in [8, 9, A, B]
    return v.toString(16);
  });
}

export function uuidv4() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Per RFC4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return [...bytes].map((b, i) => {
      const hex = b.toString(16).padStart(2, '0');
      return [4, 6, 8, 10].includes(i) ? '-' + hex : hex;
    }).join('');
  } else {
    return fallbackUUIDv4();
  }
}

export {gid, gen}

export function formatFloatWidth(val, maxChars = 5) {
    if (!Number.isFinite(val)) return String(val).slice(0, maxChars);
    if (val === 0) return val;
    const abs = Math.abs(val);
    let fixed = abs >= 1e-3 && abs < 1e6
        ? val.toFixed(Math.max(0, maxChars - String(Math.trunc(val)).length - 1))
        : null;
    if (fixed) fixed = fixed.replace(/\.?0+$/, '');
    if (fixed && fixed.length <= maxChars) return fixed;
    let expDigits = maxChars - 5;
    if (expDigits < 0) expDigits = 0;
    return val.toExponential(expDigits)
        .replace(/\.?0+e/, 'e')
        .replace(/e\+?(-?)0*(\d+)/, 'e$1$2');
}

export const valmap = (fn, obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));

export const keymap = (fn, obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [fn(k), v]));


export function assertHas(obj, key, context = "") {
  if (!(key in obj)) {
    const summary = context ? ` in ${context}` : "";
    throw new Error(`Expected key "${key}" to exist${summary}, but it was not found.`);
  }
  return obj[key]; // enables chaining
}

/**
 * Deep-equals for primitives, Arrays, and TypedArrays.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function isEqual(a, b) {
  // identical or both NaN
  if (a === b || (Number.isNaN(a) && Number.isNaN(b))) return true;
  // must be same “class”
  if (Object.prototype.toString.call(a) !== Object.prototype.toString.call(b)) {
    return false;
  }
  // Arrays
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  }
  // TypedArrays (excludes DataView)
  if (ArrayBuffer.isView(a) && !(a instanceof DataView)) {
    if (a.constructor !== b.constructor || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  // everything else must have been === already
  return false;
}


export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function vandalStamp(ext) {
    const date = new Date();
    const timestamp = date.toISOString().replace(/[^0-9]/g, '');
    return `vandal_${timestamp}.${ext}`
}

/**
 * Generate a normalized 1D kernel based on shape, radius, and softness.
 * @param {string} type - Kernel shape ('gaussian', 'lorentzian', 'box', etc.)
 * @param {number} radius - Half-width in pixels (controls size, not array length)
 * @param {number} softness - Shape-specific param (e.g. sigma, decay, etc.)
 * @returns {Float32Array} - Normalized kernel
 */
export function generateKernel(type, radius = 3, softness = 1.0) {
    const size = Math.max(3, 2 * Math.ceil(radius) + 1);
    const kernel = new Float32Array(size);
    const half = Math.floor(size / 2);
    let sum = 0;

    for (let i = 0; i < size; i++) {
        const x = i - half;
        let w = 0;
        switch (type) {
            case 'gaussian':
                w = Math.exp(-0.5 * (x * x) / (softness * softness));
                break;
            case 'lorentzian':
                w = 1.0 / (1.0 + (x * x) / (softness * softness));
                break;
            case 'exponential':
                w = Math.exp(-Math.abs(x) / softness);
                break;
            case 'box':
                w = 1.0;
                break;
            case 'flattop':
                w = Math.exp(-0.5 * (x * x) / (softness * softness)) *
                    (1.0 + 0.2 * Math.cos((2.0 * Math.PI * x) / size));
                break;
            case 'sinc':
                const t = x / (softness || 1.0);
                w = t === 0 ? 1.0 : Math.sin(Math.PI * t) / (Math.PI * t);
                break;
            case 'gabor':
                const freq = 0.5; // cycles per pixel
                w = Math.exp(-0.5 * (x * x) / (softness * softness)) *
                    Math.cos(2.0 * Math.PI * freq * x);
                break;
            case 'altsign':
                w = i % 2 === 0 ? 1 : -1;
                break;
            case 'saw':
                w = i + 1;
                break;
            case 'sobel1d':
                w = i - Math.floor(radius / 2);
                break;
            case 'impulse':
                for (let i = 0; i < size; i++) {
                    kernel[i] = (i === half - 2) ? 1 : (i === half + 2) ? -1 : 0;
                }
                return kernel;
            default:
                throw new Error(`unknown kernel type ${type}`);
        }
        kernel[i] = w;
        sum += w;
    }
    if (type !== 'altsign') {
        // DO NOT NORMALIZE
        for (let i = 0; i < size; i++) {
            kernel[i] /= sum;
        }
    }
    if (type === "saw") {
        const sum = kernel.reduce((a, b) => a + b, 0);
        return kernel.map(v => v / sum);
    }
    return kernel;
}

function normalizeKernel(kernel) {
    const sum = kernel.reduce((a, b) => a + b, 0);
    if (sum === 0) return kernel;
    return kernel.map(v => v / sum);
}

/**
 * Generate a 2D convolution kernel via outer product of a 1D kernel.
 * @param {string} type - Kernel shape type
 * @param {number} radiusX - Horizontal kernel radius
 * @param {number} radiusY - Vertical kernel radius
 * @param {number} softness - Shape parameter (passed to 1D generator)
 * @returns {{
 *   kernel: Float32Array,
 *   width: number,
 *   height: number,
 *   weight: number,
 * }}
 */
export function generate2DKernel(type, radiusX = 3, radiusY = 3, softness = 1.0) {
    const kernelX = generateKernel(type, radiusX, softness);
    const kernelY = generateKernel(type, radiusY, softness);
    const width = kernelX.length;
    const height = kernelY.length;

    const kernel = new Float32Array(width * height);
    let sum = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const value = kernelX[x] * kernelY[y];
            kernel[y * width + x] = value;
            sum += value;
        }
    }
    return {
        kernel: normalizeKernel(kernel),
        width: width,
        height: height,
        weight: 1.0
    };
}

export const KernelTypeEnum = {
    GAUSSIAN: 'gaussian',
    LORENTZIAN: 'lorentzian',
    EXPONENTIAL: 'exponential',
    BOX: 'box',
    FLATTOP: 'flattop',
    SINC: 'sinc',
    GABOR: 'gabor',
    SOBEL1D: 'sobel1d',
    ALTSIGN: 'altsign',
    SAW: 'saw',
    IMPULSE: 'impulse'
};


export function subsampleKernel2D(kernel, width, height, maxSize) {
    const ratio = Math.sqrt(maxSize / (width * height));
    const newW = Math.max(1, Math.floor(width * ratio));
    const newH = Math.max(1, Math.floor(height * ratio));

    const out = new Float32Array(newW * newH);
    let sum = 0;
    for (let y = 0; y < newH; y++) {
        for (let x = 0; x < newW; x++) {
            const srcX = Math.floor((x / newW) * width);
            const srcY = Math.floor((y / newH) * height);
            const v = kernel[srcY * width + srcX];
            out[y * newW + x] = v;
            sum += v;
        }
    }

    const normed = normalizeKernel(out);
    return {
        kernel: normed,
        width: newW,
        height: newH,
        weight: 1.0
    };
}

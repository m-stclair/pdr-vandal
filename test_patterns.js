import {clearRenderCache, resizeAndRedraw, appRenderer, activeFile, loadFloatSource} from "./state.js";
import {gid} from "./utils/helpers.js";
import {hsv2Rgb} from "./utils/colorutils.js";
import {makeBayerTestMosaic} from "./utils/bayer_pattern.js";
import {approxPercentiles} from "./utils/stretch.js";


// Resolves once the pattern is the image source, so callers that await
// drawPattern() know the source has actually changed.
function uploadFromCanvas(ocv, name="") {
    gid("activeFile").innerText = `${name} test pattern`;
    activeFile[0] = `${name} test pattern`;
    return ocv.convertToBlob().then(blob => new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image(ocv.width, ocv.height);
        img.onload = () => {
            appRenderer.setHTMLSource(img);
            resizeAndRedraw();
            resolve();
        };
        img.onerror = reject;
        clearRenderCache();
        img.src = url;
    })).catch(error => {
        console.error("Failed to load test pattern:", error);
    });
}

export async function drawSquare(color='black') {
    const ocv = new OffscreenCanvas(2048, 2048)
    const ctx = ocv.getContext('2d')
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 2048, 2048);
    await uploadFromCanvas(ocv, color);
}

export async function drawRGBSquares() {
    const ocv = new OffscreenCanvas(2048, 2048)
    const ctx = ocv.getContext('2d')

    const squareSize = ocv.width / 4;
    const gap = ocv.width / 15;
    const startX = gap;
    const posY = (ocv.height - squareSize) / 2;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, ocv.width, ocv.height);
    const colors = ['red', 'green', 'blue'];
    colors.forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.fillRect(
            startX + i * (squareSize + gap),
            posY,
            squareSize,
            squareSize
        );
    });
    await uploadFromCanvas(ocv, "RGB square");
}

export async function drawBlank() {
    const ocv = new OffscreenCanvas(1, 1);
    const ctx = ocv.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 1, 1);
    await uploadFromCanvas(ocv, "blank");
}

export async function drawGrayscaleRamp() {
    const ocv = new OffscreenCanvas(2048, 2048)
    const ctx = ocv.getContext('2d')

    const grad = ctx.createLinearGradient(0, 0, ocv.width, 0);
    grad.addColorStop(0, 'black');
    grad.addColorStop(1, 'white');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ocv.width, ocv.height);
    await uploadFromCanvas(ocv, "gray ramp");
}

export async function drawHueWheel() {
    const ocv = new OffscreenCanvas(2048, 2048)
    const context = ocv.getContext('2d');
    const radius = ocv.width / 2;
    const centerX = radius;
    const centerY = radius;

    context.clearRect(0, 0, ocv.width, ocv.height);

    const imageData = context.createImageData(ocv.width, ocv.height);
    const data = imageData.data;

    for (let y = 0; y < ocv.height; y++) {
        for (let x = 0; x < ocv.width; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < radius) {
                const angle = Math.atan2(dy, dx) + Math.PI;
                const hue = angle / (2 * Math.PI);

                const [r, g, b] = hsv2Rgb(hue, 1, 1);

                const pixelIndex = (y * ocv.width + x) * 4;
                data[pixelIndex] = r * 255;
                data[pixelIndex + 1] = g * 255;
                data[pixelIndex + 2] = b * 255;
                data[pixelIndex + 3] = 255;
            }
        }
    }
    context.putImageData(imageData, 0, 0);
    await uploadFromCanvas(ocv, "hue wheel");
}

async function drawSpiral(numLoops = 5, lineWidth = 4) {
    const canvas = new OffscreenCanvas(2048, 2048)
    const context = canvas.getContext('2d');

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY);

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.beginPath();
    context.moveTo(centerX, centerY);

    const step = 0.1;
    for (let t = 0; t < numLoops * Math.PI * 2; t += step) {
        const radius = maxRadius * t / (numLoops * Math.PI * 2);
        const x = centerX + radius * Math.cos(t);
        const y = centerY + radius * Math.sin(t);

        context.lineTo(x, y);
    }

    context.lineWidth = lineWidth;
    context.strokeStyle = 'black';
    context.stroke();
    await uploadFromCanvas(canvas, "spiral");
}

async function drawSinusoid(amplitude = 512, frequency = 0.05) {
    const canvas = new OffscreenCanvas(2048, 2048)
    const context = canvas.getContext('2d');

    const midY = canvas.height / 2;

    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    context.moveTo(0, midY);

    for (let x = 0; x < canvas.width; x++) {
        const y = midY + amplitude * Math.sin(frequency * x);
        context.lineTo(x, y);
    }

    context.strokeStyle = 'black';
    context.lineWidth = 4;
    context.stroke();
    await uploadFromCanvas(canvas, "sinusoid")
}

// Simulated raw RGGB frame for testing and demoing the Debayer effect:
// loaded as single-band float data, like a raw PDS image, with the
// statistics Input Stretch's clip modes use (already in [0, 1], so scale 1
// and offset 0). Returns the {pixels, width, height} array it loaded, so the
// crop / rotate toolbar can transform it.
export async function drawBayerTest() {
    const size = 2048;
    const array = {pixels: makeBayerTestMosaic(size), width: size, height: size};
    loadFloatSource(floatArrayData(array.pixels, size, size));
    clearRenderCache();
    resizeAndRedraw();
    gid("activeFile").innerText = "bayer rggb test pattern";
    activeFile[0] = "bayer rggb test pattern";
    return array;
}

/**
 * loadFloatSource() input for a single-band array of values in [0, 1]
 * (scale 1, offset 0), with the statistics Input Stretch's clip modes use;
 * non-finite pixels are left out of them.
 */
export function floatArrayData(pixels, width, height) {
    let sum = 0, sum2 = 0, n = 0;
    for (const v of pixels) {
        if (!Number.isFinite(v)) continue;
        sum += v;
        sum2 += v * v;
        n++;
    }
    const mean = n ? sum / n : 0;
    const [p02, p98] = approxPercentiles(pixels, 2, 98);
    return {
        pixels, width, height, channels: 1, scale: 1, offset: 0,
        mean, std: n ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) : 0, p02, p98,
    };
}

// Returns the pattern's {pixels, width, height} float array if it is one,
// else undefined (patterns drawn on a canvas).
export async function drawPattern(pattern) {
    switch (pattern) {
        case "black":
            await drawSquare('black');
            return;
        case "white":
            await drawSquare('white');
            return;
        case "rgb":
            await drawRGBSquares();
            break;
        case "gray":
            await drawGrayscaleRamp();
            break;
        case "wheel":
            await drawHueWheel();
            break;
        case "spiral":
            await drawSpiral(12, 4);
            break;
        case "sinusoid":
            await drawSinusoid();
            break;
        case "blank":
            await drawBlank();
            break;
        case "bayer rggb":
            // the only pattern made as float data, which geometry can apply to
            return await drawBayerTest();
        default:
            throw new Error(`unknown pattern ${pattern}`);

    }

}

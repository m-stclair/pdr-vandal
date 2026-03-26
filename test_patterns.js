import {clearRenderCache, resizeAndRedraw, appRenderer} from "./state.js";
import {gid} from "./utils/helpers.js";
import {hsv2Rgb} from "./utils/colorutils.js";
import {placeholderOption} from "./ui.js";


function uploadFromCanvas(ocv, name="") {
    ocv.convertToBlob().then(blob => {
        const url = URL.createObjectURL(blob);
        const img = new Image(ocv.width, ocv.height);
        img.onload = () => {
            appRenderer.setHTMLSource(img);
            resizeAndRedraw();
        };
        clearRenderCache();
        img.src = url;
    }).catch(error => {
        console.error("Failed to convert OffscreenCanvas to Blob:", error);
    });
    gid("activeFile").innerText = `${name} test pattern`;
}

export async function drawSquare(color='black') {
    const ocv = new OffscreenCanvas(2048, 2048)
    const ctx = ocv.getContext('2d')
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 2048, 2048);
    uploadFromCanvas(ocv, color);
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
    uploadFromCanvas(ocv, "RGB square");
}

export async function drawBlank() {
    const ocv = new OffscreenCanvas(1, 1);
    const ctx = ocv.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 1, 1);
    uploadFromCanvas(ocv, "blank");
}

export async function drawGrayscaleRamp() {
    const ocv = new OffscreenCanvas(2048, 2048)
    const ctx = ocv.getContext('2d')

    const grad = ctx.createLinearGradient(0, 0, ocv.width, 0);
    grad.addColorStop(0, 'black');
    grad.addColorStop(1, 'white');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ocv.width, ocv.height);
    uploadFromCanvas(ocv, "gray ramp");
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
    uploadFromCanvas(ocv, "hue wheel");
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
    uploadFromCanvas(canvas, "spiral");
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
    uploadFromCanvas(canvas, "sinusoid")
}

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
        default:
            throw new Error(`unknown pattern ${pattern}`);

    }

}


export function populateTestSelect() {
    const testSelect = gid("test-pattern-select");
    testSelect.appendChild(placeholderOption("-- pattern --"));
    ["black", "white", "rgb", "gray", "wheel", "spiral", "sinusoid"].forEach(type => {
        const opt = document.createElement("option");
        opt.value = opt.text = type;
        testSelect.appendChild(opt);
    });
    testSelect.addEventListener("input", async () => await drawPattern(testSelect.value))
}

populateTestSelect()
import {
    pdrErrorModal,
    pdrErrorModalContent,
    setupExportImage,
    setupHelpModal,
    setupPaneDrag,
    setupPDRErrorModal,
    setupStaticButtons,
    setupWindow
} from "./ui.js";

import {
    defaultCtx,
    addEffectToStack,
    clearRenderCache,
    Dirty,
    getEffectById,
    getEffectStack,
    getAnimationFrozen,
    inputStretchEffect,
    Lock,
    makeEffectInstance,
    appRenderer,
    requestRender,
    requestUIDraw,
    resetStack,
    resizeAndRedraw,
    toggleEffectSelection,
    uiState, setFreezeAnimationButtonFlag, lockRender, unlockRender
} from "./state.js";
// import "./tools/debugPane.js";
import {downloadBlob, formatFloatWidth, gid, vandalStamp} from "./utils/helpers.js";
import {renderStackUI} from "./ui_builder.js";
import {effectRegistry} from "./registry.js";
import {resolveAnim} from "./utils/animutils.js";

// noinspection ES6UnusedImports
import {EffectPicker} from './components/effectpicker.js'
import {pdrInitializedFlag, initPDR, getPyodide, getProductInfo, getArrayImage, flushPdrCache} from "./pdr.js";
import {drawPattern} from "./test_patterns.js";
import {getAppPresetView} from "./utils/presets.js";


let animating = false;
let startTime = null;
let timePhase = 0;

const dataObjectSelect = gid("data-object-select");
const imageBandSelect = gid("image-band-select");

function handleHTMLUpload(e) {
    let file;
    if (!(e instanceof File)) {
        file = e.target.files[0];
    } else {
        file = e;
    }
    if (!file) return;

    const img = new Image();
    img.onload = async () => {
        appRenderer.setHTMLSource(img);
        gid("pdrUI").style.display = "none"
        await resetPdr();
        resizeAndRedraw();
    }
    gid("activeFile").innerText = file.name;
    img.src = URL.createObjectURL(file);
}

// info for 'active' product
let pdrProductInfo = {};

let currentImageRequest = 0;

async function resetPdr() {
    if (!pdrInitializedFlag || !pdrProductInfo.name) return;
    await flushPdrCache();

    if (pdrProductInfo.files) {
        const pyodide = await getPyodide();
        for (const f of pdrProductInfo.files) {
            pyodide.FS.unlink(f);
        }
        pdrProductInfo.files = undefined;
    }
    pdrProductInfo.name = undefined;
    gid("pdrUI").style.display = "none"
}

async function handlePdrBandSelect() {
    if (!pdrProductInfo.name) return;
    const requestId = ++currentImageRequest;

    try {
        const fn = pdrProductInfo.name;
        const objname = dataObjectSelect.value;
        const band = imageBandSelect.value;
        const arrayData = await getArrayImage(fn, objname, Number(band));

        if (requestId !== currentImageRequest) {
            console.warn("Debounced PDR band select request");
            return;
        }

        appRenderer.setFloat32Source(arrayData.pixels, arrayData.width,
            arrayData.height, arrayData.channels,
            arrayData.scale, arrayData.offset);
        inputStretchEffect.auxiliaryCache.mean = arrayData.mean;
        inputStretchEffect.auxiliaryCache.std = arrayData.std;
        inputStretchEffect.auxiliaryCache.p02 = arrayData.p02;
        inputStretchEffect.auxiliaryCache.p98 = arrayData.p98;
        gid("activeFile").innerText = pdrProductInfo.name;
        resizeAndRedraw();
    } catch (err) {
        showPDRErrorModal(err);
    }
}


async function handlePdrObjectChange() {
    if (!pdrProductInfo) return;
    const objname = dataObjectSelect.value
    if (!pdrProductInfo) return;
    const objInfo = pdrProductInfo['objects'][objname];
    if (objInfo === undefined) {
        throw new Error(`${objname} not in product`)
    }
    const maxDimension = appRenderer.gl.getParameter(appRenderer.gl.MAX_TEXTURE_SIZE);
    if (objInfo.width > maxDimension || objInfo.height > maxDimension) {
        showPDRErrorModal(
            `Array too large for this browser (max dimension is ${maxDimension}).`
        )
        return;
    }
    imageBandSelect.options.length = 0;
    if (objInfo['bands'] === 3 || objInfo['bands'] === 4) {
        const opt = document.createElement('option')
        opt.value = 'RGB';
        opt.textContent = 'RGB'
        imageBandSelect.options.add(opt);
    }
    for (let i = 0; i < objInfo['bands']; i++) {
        const opt = document.createElement('option')
        opt.value = i;
        opt.textContent = String(i);
        imageBandSelect.options.add(opt);
    }
    imageBandSelect.options[0].selected = true;
    await handlePdrBandSelect();
}

dataObjectSelect.addEventListener('change', async () => {
    lockRender();
    await handlePdrObjectChange();
    requestRender();
    unlockRender();
})

imageBandSelect.addEventListener('change', async () => {
    lockRender();
    await handlePdrBandSelect();
    requestRender();
    unlockRender();
})

async function populatePdrUI() {
    if (!pdrProductInfo) return;
    dataObjectSelect.options.length = 0;
    Object.keys(pdrProductInfo['objects']).forEach(
        function (name) {
            const opt = document.createElement('option')
            opt.value = name;
            opt.textContent = name;
            dataObjectSelect.options.add(opt);
        }
    )
    dataObjectSelect.options[0].selected = true;
    gid("pdrUI").style.display = "block"
}

function setupInputStretch() {
    const effectStack = getEffectStack();
    if (effectStack[0] === inputStretchEffect) return;
    effectStack.unshift(inputStretchEffect);
}

const pdrLoadingModal = gid("pdr-loading-modal");
const pdrLoadingModalContent = gid("pdr-loading-modal-content");
const appRoot = gid("appRoot");

function delayNextPaint() {
    return new Promise(resolve =>
        requestAnimationFrame(() =>
            requestAnimationFrame(resolve)
        )
    );
}

function eventToSourcePixel(e, renderer) {
    const gl = renderer.gl;
    const canvas = gl.canvas;
    const rect = canvas.getBoundingClientRect();

    // Event -> drawing buffer pixels, top-left origin
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Canvas -> displayed image rect
    const viewRect = renderer.getViewRect();
    if (
        px < viewRect.x ||
        px >= viewRect.x + viewRect.w ||
        py < viewRect.y ||
        py >= viewRect.y + viewRect.h
    ) {
        return null; // cursor is in the letterboxed / unused canvas area
    }

    // Position inside the displayed image, top-left origin normalized.
    const u = (px - viewRect.x) / viewRect.w;
    const v = (py - viewRect.y) / viewRect.h;

    // In the output pass we flip Y,
    // so top-left normalized screen coords map directly to the same logical
    // 0..1 coordinates used by the ingress sampling expression.
    const [spanX, spanY] = renderer.getViewSpan(viewRect.w, viewRect.h);

    const srcU = renderer.centerX + (u - 0.5) * spanX;
    const srcV = renderer.centerY + (v - 0.5) * spanY;

    const [imageW, imageH] = renderer.getSourceSize();

    const cu = Math.max(0, Math.min(1, srcU));
    const cv = Math.max(0, Math.min(1, srcV));

    return {
        srcU: cu,
        srcV: cv,
        x: Math.min(imageW - 1, Math.max(0, Math.floor(cu * imageW))),
        y: Math.min(imageH - 1, Math.max(0, Math.floor(cv * imageH))),
    };
}

const coordOutput = gid("coordOutput");

function renderCoords(e, renderer, output) {
    if (!renderer.source?.data) {
        return;
    }
    const sourcePixel = eventToSourcePixel(e, renderer);
    if (sourcePixel === null) {
        return;
    }
    const {x, y} = sourcePixel;
    let coordText = `(${Math.floor(x)}, ${Math.floor(y)})`;
    const startIndex = (x + y * renderer.source.width) * renderer.source.channels
    const values = [];
    for (let i = 0; i < renderer.source.channels; i++) {
        const value = renderer.source.data[startIndex + i];
        const unscaled = value * renderer.source.scale + renderer.source.offset;
        const displayPrecision = 4 + Math.log10(unscaled);
        values.push(formatFloatWidth(unscaled, displayPrecision));
    }
    const valText = values.join(", ");
    output.innerText = `${coordText} -- ${valText}`;
}


appRenderer.gl.canvas.addEventListener(
    'mousemove', (e) => renderCoords(e, appRenderer, coordOutput)
)


function lockApp() {
    appRoot.inert = true;
    document.body.classList.add("busy");
}

function unlockApp() {
    appRoot.inert = false;
    document.body.classList.remove("busy");
}

function showPDRErrorModal(e) {
    lockApp();
    pdrErrorModalContent.innerText = e;
    pdrErrorModal.style.display = "block";
}

async function handlePdrUpload(e) {
    // TODO: this needs to be plural to permit uploading detached labels
    const firstFile = e.target.files[0];
    if (!firstFile) return;
    lockApp();
    pdrLoadingModal.style.display = "block";
    if (!pdrInitializedFlag) {
        pdrLoadingModalContent.innerText = "Setting up PDR (wait ~20 seconds)..."
    }
    let pyodide = null;
    try {
        pyodide = await getPyodide();
        await initPDR();
        pdrLoadingModalContent.innerText = `loading ${firstFile.name}...`
        await delayNextPaint();
        for (const f of e.target.files) {
            pyodide.FS.writeFile(f.name, new Uint8Array(await f.arrayBuffer()));
        }
        // TODO: pdr will usually handle figuring out whether this is a detached label
        //  or a data file, but it can become problematic if there are files
        //  in the product that don't share filename stems with a detached label
        //  and one of those is, unfortunately, the first one -- we may need some
        //  little heuristic. e.g., this could happen for M3 products.
        const objects = await getProductInfo(firstFile.name);
        if (Object.keys(objects).length === 0) {
            showPDRErrorModal("no arrays found in file");
            for (const f of e.target.files) {
                pyodide.FS.unlink(f.name);
            }
            return;
        }
        pdrProductInfo.name = firstFile.name;
        pdrProductInfo.objects = objects;
        if (pdrProductInfo.files) {
            for (const f of pdrProductInfo.files) {
                pyodide.FS.unlink(f);
            }
        }
        pdrProductInfo.files = [...e.target.files].map((f) => f.name);
        lockRender();
        await populatePdrUI();
        await handlePdrObjectChange();
        requestUIDraw();
        requestRender();
        unlockRender();
        unlockApp();
    } catch (e) {
        console.error(e);
        pdrLoadingModal.style.display = "none";
        showPDRErrorModal(e);
        if (pyodide && e.target) {
            for (const f of e.target.files) {
                pyodide.FS.unlink(f.name);
            }
        }
    } finally {
        pdrLoadingModal.style.display = "none"
        pdrLoadingModalContent.innerText = ""
    }
}

const closeImageBtn = gid("closeImage")

async function closeImage() {
    lockApp();
    lockRender();
    appRenderer.clearEffectBuffers();
    appRenderer.clearSourceTextures();
    appRenderer.source = null;
    if (pdrProductInfo.name) {
        await resetPdr();
    }
    await drawPattern("blank");
    unlockRender();
    unlockApp();
    requestRender();
}

closeImageBtn.addEventListener("click", closeImage);

function stopCapture(recorder) {
    recorder.stop();
    document.getElementById('captureOverlay').style.display = 'none';
}

function startCapture() {
    const exportDuration = document.getElementById("exportDuration").value;
    const exportFPS = document.getElementById("exportFPS").value;

    const stream = appRenderer.gl.canvas.captureStream(exportFPS);
    const options = {
        mimeType: 'video/webm; codecs=vp9',
        videoBitsPerSecond: 16_000_000,
    }
    const recorder = new MediaRecorder(stream, options);
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
        const blob = new Blob(chunks, {type: "video/webm"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = vandalStamp('webm');
        a.click();
    };
    document.getElementById('captureOverlay').style.display = 'flex';
    recorder.start();

    setTimeout(() => stopCapture(recorder), exportDuration * 1000);
}


export function isModulating(fx) {
    return Object.values(fx.config).some(p =>
        p !== null
        && typeof p === "object"
        && p.mod?.type !== "none"
        && (!(p instanceof Array))
    )
}


async function exportImage() {
    Lock.image = true;
    const [w, h] = [appRenderer.source.width, appRenderer.source.height]
    const pixels = await appRenderer.applyFullRes(animating ? timePhase : 0);
    const imgArr = new Uint8ClampedArray(pixels.length);
    for (let i = 0; i < pixels.length; i++) {
        imgArr[i] = Math.round(pixels[i] * 255);
    }
    const imgData = new ImageData(imgArr, w, h);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").putImageData(imgData, 0, 0);
    canvas.toBlob(blob => downloadBlob(blob, vandalStamp('png')), "image/png")
    canvas.remove();
    Lock.image = false;
    requestRender();
}


const isAnimationActive = () => getEffectStack().some(fx => isModulating(fx))

let frameIx = 0;

function tick() {
    if (!animating) return;
    if (getAnimationFrozen()) {
        requestAnimationFrame(tick);
        return;
    }
    // i.e., update displayed parameter values every sixth frame
    frameIx = (frameIx + 1) % 6;
    if (frameIx === 0) {
        document.querySelectorAll(".slider-value.animating").forEach(input => {
            const key = input.dataset.key;
            const fxId = input.dataset.fxId;
            const fx = getEffectById(fxId);
            if (fx === null) {
                // this generally represents a harmless race condition -- we
                // resolved querySelectorAll() during effect teardown but before
                // the associated DOM nodes were removed.
                return;
            }
            const resolved = resolveAnim(fx.config[key], timePhase);
            input.value = formatFloatWidth(resolved);
        });
    }

    requestRender();
    if (isAnimationActive()) {
        requestAnimationFrame(tick);
    } else {
        animating = false;
    }
}

function firePipeline(ctx = defaultCtx, t = null) {
    let time;
    if (animating && t === null) {
        timePhase += 30 / 1000;
        time = timePhase;
    } else {
        time = t;
    }
    if (!appRenderer.source) return;
    const finalTexture = appRenderer.applyEffects(time);
    appRenderer.writeToCanvas(finalTexture);
}


function renderImage() {
    firePipeline();
    const animShouldBeRunning = isAnimationActive();
    if (animShouldBeRunning && !animating) {
        startTime = performance.now();
        animating = true;
        requestAnimationFrame(tick);
    } else if (!animShouldBeRunning && animating) {
        animating = false;
    }
}

function watchRender() {
    if (Lock.image || !Dirty.image) return;
    Lock.image = true;
    Dirty.image = false;
    try {
        renderImage()
    } finally {
        Lock.image = false;
    }
}

function watchUI() {
    if (Lock.ui || !Dirty.ui) return;
    Lock.ui = true;
    Dirty.ui = false;
    try {
        renderStackUI(getEffectStack(), uiState, gid('effectStack'));
    } finally {
        Lock.ui = false;
    }
}

function rafScheduler(func, name, registry) {
    return () => {
        func();
        registry[name] = requestAnimationFrame(rafScheduler(func, name, registry));
    }
}


const loopIDs = {};
const renderLoop = rafScheduler(watchRender, "render", loopIDs);
const uiLoop = rafScheduler(watchUI, "ui", loopIDs);


async function addSelectedEffect(effectName) {
    if (!effectName) return;
    const fx = makeEffectInstance(effectRegistry[effectName]);
    await fx.ready;
    addEffectToStack(fx);
    toggleEffectSelection(fx);
    const toggleBar = document.getElementById('toggle-stack-bar');
    const effectStack = document.getElementById('effectStack');
    effectStack.classList.remove('collapsed');
    toggleBar.classList.add('collapsed');
    clearRenderCache()
    requestUIDraw();
    requestRender();
}

async function appSetup() {
    const workerURL = new URL(`./cache-worker.js`, import.meta.url);
    if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register(workerURL);
    }
    const stackHeader = document.getElementById("effectStackHeader")
    const picker = document.createElement("effect-picker")
    stackHeader.appendChild(picker);
    await picker.ready;

    function toggleExpand() {
        if (picker.inSearchMode) {
            stackHeader.style.flexShrink = '0';
            stackHeader.style.flexGrow = '2';
        } else {
            stackHeader.style.flexShrink = '1';
            stackHeader.style.flexGrow = '1';
        }
    }

    picker.setEffectSelectCallback(
        async (effectName) => {
            await addSelectedEffect(effectName);
            toggleExpand();
        }
    );
    ["input", "keydown"].forEach(
        (eType) => stackHeader.addEventListener(
            eType, (e) => {
                if (e.type === "input" || e.key === "Escape" || e.key === "Enter") {
                    toggleExpand();
                }
            }
        )
    )
    const toggleBar = document.getElementById('toggle-stack-bar');
    const effectStack = document.getElementById('effectStack');
    toggleBar.addEventListener('click', function () {
        effectStack.classList.toggle('collapsed');
        toggleBar.classList.toggle('collapsed');
    });
    setupStaticButtons(
        handleHTMLUpload,
        handlePdrUpload,
        resetStack,
        requestRender,
        requestUIDraw,
        setFreezeAnimationButtonFlag
    );
    setupExportImage(exportImage);
    // setupVideoCapture(startCapture, stopCapture);
    setupPaneDrag();
    setupPDRErrorModal(unlockApp);
    setupHelpModal(lockApp, unlockApp);
    setupWindow(resizeAndRedraw);
    await drawPattern('spiral');
    setupInputStretch();
    renderLoop();
    uiLoop();
}


await appSetup();

import {
    pdrErrorModal,
    pdrErrorModalContent,
    setupAboutModal,
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
    loadFloatSource,
    Lock,
    makeEffectInstance,
    appRenderer,
    requestRender,
    requestUIDraw,
    resetStack,
    resizeAndRedraw,
    toggleEffectSelection,
    uiState, setFreezeAnimationButtonFlag, lockRender, unlockRender,
    activeFile, panInterface
} from "./state.js";
// import "./tools/debugPane.js";
import {downloadBlob, formatFloatWidth, formatSignificant, gid, vandalStamp} from "./utils/helpers.js";
import {encodeTiff} from "./utils/tiff.js";
import {renderStackUI} from "./ui_builder.js";
import {effectRegistry} from "./registry.js";
import {resolveAnim} from "./utils/animutils.js";

// noinspection ES6UnusedImports
import {EffectPicker} from './components/effectpicker.js'
import {HistogramPanel} from './components/histogram.js'
import {MetadataPanel} from './components/metadata.js'
import {setupOpenFileModal} from './components/openfile.js'
import {
    pdrInitializedFlag, initPDR, preloadPDR, getPyodide, getProductInfo, getArrayImage,
    flushPdrCache, getProductLabel
} from "./pdr.js";
import {
    bayerWarning, clampGeometry, composeOrientation, cropToRegion, geometrySuffix,
    identityGeometry, isIdentity, outputSize, pushHistory, toOriginalPixel, withAutoBin,
    withoutBin, applyGeometryToArray
} from "./utils/geometry.js";
import {drawPattern, floatArrayData} from "./test_patterns.js";
// Shown at start-up and after Close Image: a simulated raw frame, loaded as
// float data like a PDR product, so Input Stretch and Debayer apply to it.
const DEFAULT_PATTERN = "bayer rggb";
import {getAppPresetView} from "./utils/presets.js";


let animating = false;
// Histogram of the displayed image (created in appSetup).
export let histogramPanel = null;
// Searchable pane of the product's labels and headers (created in appSetup).
export let metadataPanel = null;
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
        setPdrUIVisible(false);
        await resetPdr();
        // a browser image has no float array to crop or rotate
        localArray = null;
        resetGeometry();
        setGeometryToolbarVisible(false);
        resizeAndRedraw();
    }
    gid("activeFile").innerText = file.name;
    activeFile[0] = file.name;
    img.src = URL.createObjectURL(file);
}

// info for 'active' product
let pdrProductInfo = {};

// The float array made in the browser that is shown when no PDR product is
// loaded (the start-up test pattern): {pixels, width, height}, untransformed,
// or null. Crop / rotate / flip apply to it in JS (loadCurrentArray).
let localArray = null;

// Crop / rotate / flip the user chose for the current PDR object, or for
// localArray (utils/geometry.js), in original pixel coordinates, with bin
// always 1; null means none. Reset when the object changes, kept across
// band changes.
let pdrGeometry = null;
// The geometry actually applied to the array on display (by Python for a
// PDR band): pdrGeometry clamped, plus the automatic bin an over-large array
// needs to fit in one texture. null for the untransformed array.
let pdrResolvedGeometry = null;
// Earlier values of pdrGeometry, newest last, for the undo button.
const GEOMETRY_HISTORY_CAP = 10;
let geometryHistory = [];
// Pixel array of the geometry-capable array on display (PDR band or
// localArray), so the coordinate readout and the toolbar know whether the
// renderer source is still that array (and pdrResolvedGeometry applies)
// rather than a browser image.
let displayedArrayPixels = null;

// Width / height (and, for PDR, the rest of the object info) of the array
// the toolbar works on.
function currentObjInfo() {
    if (pdrProductInfo.name) return pdrProductInfo.objects?.[dataObjectSelect.value];
    return localArray ?? undefined;
}

function resetGeometry() {
    pdrGeometry = null;
    pdrResolvedGeometry = null;
    geometryHistory = [];
}

let currentImageRequest = 0;

async function resetPdr() {
    labelRequest++;
    metadataPanel?.clear();
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
    resetGeometry();
    displayedArrayPixels = null;
    // the toolbar is left to whatever is shown next
    setPdrUIVisible(false);
}

// The object / band selectors.
function setPdrUIVisible(visible) {
    gid("pdrUI").style.display = visible ? "block" : "none";
}

// The crop / rotate toolbar: shown for PDR products and localArray.
function setGeometryToolbarVisible(visible) {
    gid("geometryToolbar").style.display = visible ? "block" : "none";
    if (!visible) endCropSelect();
}

// Show the start-up test pattern, untransformed, with the toolbar working
// on it (startup and Close Image).
async function showDefaultPattern() {
    resetGeometry();
    localArray = (await drawPattern(DEFAULT_PATTERN)) ?? null;
    displayedArrayPixels = localArray?.pixels ?? null;
    setGeometryToolbarVisible(localArray !== null);
    updateGeometryUI();
}

// Load the array the toolbar works on with the current geometry: the PDR
// band through Python, or localArray here. Returns true once displayed.
async function loadCurrentArray() {
    if (pdrProductInfo.name) return await handlePdrBandSelect();
    if (!localArray) return false;
    const {pixels, width, height} = localArray;
    const requested = requestedGeometry(localArray);
    const shown = requested ? applyGeometryToArray(pixels, width, height, requested) : localArray;
    pdrResolvedGeometry = requested;
    displayedArrayPixels = shown.pixels;
    loadFloatSource(floatArrayData(shown.pixels, shown.width, shown.height));
    clearRenderCache();
    updateGeometryUI();
    resizeAndRedraw();
    requestUIDraw();
    return true;
}

function maxTextureSize() {
    return appRenderer.gl.getParameter(appRenderer.gl.MAX_TEXTURE_SIZE);
}

// What to ask Python for: the user's geometry plus the bin needed to fit,
// or null for the untransformed array.
function requestedGeometry(objInfo) {
    const g = withAutoBin(
        clampGeometry(pdrGeometry ?? identityGeometry(objInfo.width, objInfo.height),
            objInfo.width, objInfo.height),
        maxTextureSize()
    );
    return isIdentity(g, objInfo.width, objInfo.height) ? null : g;
}

// returns true if the selected band was loaded and displayed
async function handlePdrBandSelect() {
    if (!pdrProductInfo.name) return false;
    const requestId = ++currentImageRequest;

    try {
        const fn = pdrProductInfo.name;
        const objname = dataObjectSelect.value;
        const band = imageBandSelect.value;
        const objInfo = pdrProductInfo.objects[objname];
        const requested = requestedGeometry(objInfo);
        const geometry = requested ? JSON.stringify(requested) : null;
        const arrayData = await getArrayImage(fn, objname, Number(band), geometry);

        if (requestId !== currentImageRequest) {
            console.warn("Debounced PDR band select request");
            return false;
        }

        // the geometry Python actually applied (clamped), or null for none
        pdrResolvedGeometry = arrayData.geometry ? JSON.parse(arrayData.geometry) : null;
        displayedArrayPixels = arrayData.pixels;
        loadFloatSource(arrayData);
        updateGeometryUI();
        gid("activeFile").innerText = pdrProductInfo.name;
        activeFile[0] = pdrProductInfo.name;
        resizeAndRedraw();
        requestUIDraw();
        return true;
    } catch (err) {
        showPDRErrorModal(err);
        return false;
    }
}


function populateBandOptions(objInfo) {
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
}

// returns true if the selected object's first band was loaded and displayed
async function handlePdrObjectChange() {
    if (!pdrProductInfo.name) return false;
    const objname = dataObjectSelect.value
    const objInfo = pdrProductInfo['objects'][objname];
    if (objInfo === undefined) {
        throw new Error(`${objname} not in product`)
    }
    // An array too large for one texture is rebinned just enough to fit
    // (requestedGeometry), rather than refused; cropping to a region that
    // fits shows it at full resolution.
    pdrGeometry = null;
    pdrResolvedGeometry = null;
    geometryHistory = [];
    populateBandOptions(objInfo);
    return await handlePdrBandSelect();
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

// --- crop / rotate / flip ----------------------------------------------

const cropSelectButton = gid("geom-crop-select");
const cropViewButton = gid("geom-crop-view");
const undoButton = gid("geom-undo");
const resetButton = gid("geom-reset");
const cropOverlay = gid("cropSelectOverlay");

// whether the renderer is showing the PDR band (not a test pattern or
// browser image), so its view maps onto pdrResolvedGeometry
function showingGeometryArray() {
    return displayedArrayPixels !== null && appRenderer.source?.data === displayedArrayPixels;
}

function currentGeometry(objInfo) {
    return pdrGeometry ?? identityGeometry(objInfo.width, objInfo.height);
}

function updateGeometryUI() {
    const objInfo = currentObjInfo();
    if (!objInfo) return;
    const {width: W, height: H} = objInfo;
    const g = pdrResolvedGeometry ?? identityGeometry(W, H);

    const onBand = showingGeometryArray();
    cropSelectButton.disabled = !onBand;
    cropViewButton.disabled = !onBand;
    undoButton.disabled = geometryHistory.length === 0;
    resetButton.disabled = isIdentity(currentGeometry(objInfo), W, H);
    if (!onBand) endCropSelect();

    const status = gid("geom-status");
    status.replaceChildren();
    const [ow, oh] = outputSize(g);
    const lines = isIdentity(g, W, H)
        ? [`full ${W}×${H} array`]
        : [`${ow}×${oh} from ${W}×${H} (${geometrySuffix(g, W, H)})`];
    if (g.bin > 1) {
        lines.push(
            `Larger than this browser's maximum texture size (${maxTextureSize()}); ` +
            `downsampled ${g.bin}×${g.bin} to fit. Crop to see full resolution.`
        );
    }
    status.append(lines.join("\n"));
    const debayer = getEffectStack().some(fx => fx.name === "Debayer" && !fx.disabled);
    const warning = debayer ? bayerWarning(g) : null;
    if (warning) {
        const w = document.createElement("div");
        w.className = "warn";
        w.textContent = warning;
        status.append(w);
    }
}

// Load the current band with a new user geometry, starting from a
// fit-to-window view of the result. Unless `record` is false, the geometry
// it replaces goes on the undo stack once the load succeeds.
async function applyGeometry(next, {record = true} = {}) {
    const objInfo = currentObjInfo();
    if (!objInfo) return;
    const {width: W, height: H} = objInfo;
    const previous = pdrGeometry;
    pdrGeometry = withoutBin(clampGeometry(next, W, H));
    appRenderer.zoom = 1.0;
    appRenderer.centerX = 0.5;
    appRenderer.centerY = 0.5;
    lockRender();
    try {
        if (await loadCurrentArray()) {
            if (record) {
                geometryHistory = pushHistory(
                    geometryHistory, previous ?? identityGeometry(W, H), GEOMETRY_HISTORY_CAP
                );
            }
        } else {
            pdrGeometry = previous;
        }
        updateGeometryUI();
    } finally {
        requestRender();
        unlockRender();
    }
}

for (const op of ["cw", "ccw", "flipH", "flipV"]) {
    gid(`geom-${op}`).addEventListener("click", () => {
        const objInfo = currentObjInfo();
        if (!objInfo) return;
        applyGeometry(composeOrientation(currentGeometry(objInfo), op));
    });
}

// Crop to a uv rect of the displayed array. The bin of the result is
// dropped: the next load re-derives it for the smaller region.
function cropToUV(region) {
    const objInfo = currentObjInfo();
    if (!objInfo || !showingGeometryArray()) return;
    const g = pdrResolvedGeometry ?? identityGeometry(objInfo.width, objInfo.height);
    applyGeometry(cropToRegion(g, region));
}

cropViewButton.addEventListener("click", () => cropToUV(appRenderer.getViewRegion()));

undoButton.addEventListener("click", () => {
    if (geometryHistory.length === 0) return;
    const prev = geometryHistory[geometryHistory.length - 1];
    geometryHistory = geometryHistory.slice(0, -1);
    applyGeometry(prev, {record: false});
});

resetButton.addEventListener("click", () => {
    const objInfo = currentObjInfo();
    if (!objInfo) return;
    applyGeometry(identityGeometry(objInfo.width, objInfo.height));
});

// --- freeform crop selection ---
// While the crop tool is active, a drag on the canvas selects a rectangle
// (kept in source uv, so it stays put on the image) instead of panning.

const canvasEl = appRenderer.gl.canvas;
let cropSelecting = false;
// {pointerId, start: {u, v}, end: {u, v}, x0, y0} while dragging
let cropDrag = null;
const MIN_CROP_DRAG_PX = 4;

function beginCropSelect() {
    if (!showingGeometryArray()) return;
    cropSelecting = true;
    panInterface.enabled = false;
    cropSelectButton.classList.add("active");
    canvasEl.classList.add("crop-selecting");
}

function endCropSelect() {
    cropSelecting = false;
    cancelCropDrag();
    panInterface.enabled = true;
    cropSelectButton.classList.remove("active");
    canvasEl.classList.remove("crop-selecting");
}

function cancelCropDrag() {
    if (cropDrag && canvasEl.hasPointerCapture?.(cropDrag.pointerId)) {
        canvasEl.releasePointerCapture(cropDrag.pointerId);
    }
    cropDrag = null;
    cropOverlay.hidden = true;
}

function eventUV(e) {
    const {srcU, srcV} = appRenderer.clientToSourceUV(e.clientX, e.clientY);
    return {u: Math.max(0, Math.min(1, srcU)), v: Math.max(0, Math.min(1, srcV))};
}

function drawCropOverlay() {
    if (!cropDrag) return;
    const a = appRenderer.sourceUVToClient(cropDrag.start.u, cropDrag.start.v);
    const b = appRenderer.sourceUVToClient(cropDrag.end.u, cropDrag.end.v);
    Object.assign(cropOverlay.style, {
        left: `${Math.min(a.clientX, b.clientX)}px`,
        top: `${Math.min(a.clientY, b.clientY)}px`,
        width: `${Math.abs(b.clientX - a.clientX)}px`,
        height: `${Math.abs(b.clientY - a.clientY)}px`,
    });
    cropOverlay.hidden = false;
}

cropSelectButton.addEventListener("click", () => {
    if (cropSelecting) endCropSelect(); else beginCropSelect();
});

canvasEl.addEventListener("pointerdown", (e) => {
    if (!cropSelecting || e.button !== 0) return;
    if (!appRenderer.clientToSourceUV(e.clientX, e.clientY).inImage) return;
    const start = eventUV(e);
    cropDrag = {pointerId: e.pointerId, start, end: start, x0: e.clientX, y0: e.clientY};
    canvasEl.setPointerCapture?.(e.pointerId);
    e.preventDefault();
});

canvasEl.addEventListener("pointermove", (e) => {
    if (!cropDrag || e.pointerId !== cropDrag.pointerId) return;
    cropDrag.end = eventUV(e);
    drawCropOverlay();
});

canvasEl.addEventListener("pointerup", (e) => {
    if (!cropDrag || e.pointerId !== cropDrag.pointerId) return;
    const drag = cropDrag;
    drag.end = eventUV(e);
    const moved = Math.max(Math.abs(e.clientX - drag.x0), Math.abs(e.clientY - drag.y0));
    cancelCropDrag();
    if (moved < MIN_CROP_DRAG_PX) return;  // a click, not a selection
    const u0 = Math.min(drag.start.u, drag.end.u), u1 = Math.max(drag.start.u, drag.end.u);
    const v0 = Math.min(drag.start.v, drag.end.v), v1 = Math.max(drag.start.v, drag.end.v);
    if (u1 <= u0 || v1 <= v0) return;
    endCropSelect();
    cropToUV({u0, u1, v0, v1});
});

canvasEl.addEventListener("pointercancel", (e) => {
    if (cropDrag && e.pointerId === cropDrag.pointerId) cancelCropDrag();
});

// Zooming mid-drag would move the image under a half-drawn box; drop it.
// (Zooming with the tool active but no drag in progress is fine.)
canvasEl.addEventListener("wheel", () => {
    if (cropDrag) cancelCropDrag();
}, {passive: true});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && cropSelecting) endCropSelect();
});

// Filename tag for exports of a transformed PDR object, e.g. "crop..._rot90"
// (with "_bin2" etc. when it was downsampled to fit).
function exportTag() {
    const objInfo = currentObjInfo();
    if (!objInfo || !pdrResolvedGeometry || !showingGeometryArray()) return "";
    return geometrySuffix(pdrResolvedGeometry, objInfo.width, objInfo.height);
}

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
    setPdrUIVisible(true);
    setGeometryToolbarVisible(true);
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
    const {srcU, srcV, inImage} = renderer.clientToSourceUV(e.clientX, e.clientY);
    if (!inImage) {
        return null; // cursor is in the letterboxed / unused canvas area
    }

    const [imageW, imageH] = renderer.getImageSize();

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
// last canvas mousemove, so the readout can refresh after a re-render
let lastCoordEvent = null;

function renderCoords(e, renderer, output) {
    if (!renderer.source?.data) {
        return;
    }
    const sourcePixel = eventToSourcePixel(e, renderer);
    if (sourcePixel === null) {
        return;
    }
    const {x, y} = sourcePixel;
    const [imageW, imageH] = renderer.getImageSize();
    let coordText = `(${Math.floor(x)}, ${Math.floor(y)}) of ${imageW}×${imageH}`;
    const [rx, ry] = renderer.imageToSourcePixel(x, y);
    const startIndex = (rx + ry * renderer.source.width) * renderer.source.channels
    const values = [];
    for (let i = 0; i < renderer.source.channels; i++) {
        const value = renderer.source.data[startIndex + i];
        const unscaled = value * renderer.source.scale + renderer.source.offset;
        values.push(formatSignificant(unscaled));
    }
    const valText = values.join(", ");
    const objInfo = currentObjInfo();
    if (pdrResolvedGeometry && objInfo && renderer.source.data === displayedArrayPixels
        && !isIdentity(pdrResolvedGeometry, objInfo.width, objInfo.height)) {
        // where this pixel came from in the untransformed array
        const o = toOriginalPixel(pdrResolvedGeometry, rx, ry);
        coordText += o.x1 === o.x0
            ? ` [orig (${o.x0}, ${o.y0})]`
            : ` [orig (${o.x0}–${o.x1}, ${o.y0}–${o.y1})]`;
    }
    output.innerText = `${coordText} -- ${valText}`;
}


appRenderer.gl.canvas.addEventListener('mousemove', (e) => {
    lastCoordEvent = e;
    renderCoords(e, appRenderer, coordOutput);
})
appRenderer.gl.canvas.addEventListener('mouseleave', () => {
    lastCoordEvent = null;
})


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

// Write uploaded files into the Pyodide FS, first saving the bytes of any
// same-named file they replace (e.g. one the displayed product still uses).
// Fills backups with name -> previous bytes, or null if the name was new. Each
// name is recorded before it is written, so a failure partway through can
// still be rolled back.
async function stagePdrFiles(pyodide, files, backups) {
    for (const f of files) {
        if (!backups.has(f.name)) {
            backups.set(
                f.name,
                pyodide.FS.analyzePath(f.name).exists
                    ? pyodide.FS.readFile(f.name)
                    : null
            );
        }
        pyodide.FS.writeFile(f.name, new Uint8Array(await f.arrayBuffer()));
    }
}

// Undo stagePdrFiles: restore replaced files and remove new ones. Then flush
// pdr's caches, which may hold products parsed from the failed upload's bytes
// under reused names; the displayed product reloads from disk on its next read.
async function rollbackPdrFiles(pyodide, backups) {
    for (const [name, bytes] of backups) {
        if (bytes) {
            pyodide.FS.writeFile(name, bytes);
        } else {
            try {
                pyodide.FS.unlink(name);
            } catch {
                // never written (failed before or during writing)
            }
        }
    }
    await flushPdrCache();
}

// Fill the metadata pane with the displayed product's labels and headers,
// after the new image has painted (reading them sniffs the product's data
// files, and Pyodide runs on this thread). A read that fails shows its error
// in the pane; it never fails the upload. labelRequest drops a read that a
// newer product (or closing this one) has overtaken.
let labelRequest = 0;

async function showProductLabel(name) {
    const id = ++labelRequest;
    await delayNextPaint();
    if (id !== labelRequest || pdrProductInfo.name !== name) return;
    try {
        const label = await getProductLabel(name);
        if (id === labelRequest) metadataPanel.setLabel(label);
    } catch (err) {
        console.error("reading the product label failed:", err);
        if (id === labelRequest) metadataPanel.setError(String(err?.message ?? err));
    }
}

// files: File[]; the first one is the primary file pdr reads (usually the
// label, see components/openfile.js)
async function handlePdrUpload(files) {
    const firstFile = files[0];
    if (!firstFile) return;
    lockApp();
    pdrLoadingModal.style.display = "block";
    if (!pdrInitializedFlag) {
        pdrLoadingModalContent.innerText = "Setting up PDR..."
    }
    let pyodide = null;
    const backups = new Map();
    // the displayed product, restored if this upload fails before committing
    const prev = pdrProductInfo;
    const prevObject = dataObjectSelect.value;
    const prevBand = imageBandSelect.value;
    const prevGeometry = pdrGeometry;
    const prevResolvedGeometry = pdrResolvedGeometry;
    const prevGeometryHistory = geometryHistory;
    // set once pdrProductInfo and the PDR UI point at the new product
    let switched = false;
    // set once the new product is fully displayed; past that point there is
    // nothing to roll back to
    let committed = false;

    async function restorePrevious() {
        if (switched) {
            pdrProductInfo = prev;
            if (prev.name) {
                await populatePdrUI();
                dataObjectSelect.value = prevObject;
                const objInfo = prev.objects?.[prevObject];
                if (objInfo) {
                    populateBandOptions(objInfo);
                    imageBandSelect.value = prevBand;
                }
                // the previous product is still on display, as it was
                pdrGeometry = prevGeometry;
                pdrResolvedGeometry = prevResolvedGeometry;
                geometryHistory = prevGeometryHistory;
                updateGeometryUI();
            } else {
                // the test pattern (localArray) or a browser image is still
                // on display, with the geometry it had
                setPdrUIVisible(false);
                pdrGeometry = prevGeometry;
                pdrResolvedGeometry = prevResolvedGeometry;
                geometryHistory = prevGeometryHistory;
                setGeometryToolbarVisible(localArray !== null && showingGeometryArray());
                updateGeometryUI();
            }
        }
        if (pyodide && backups.size > 0) {
            await rollbackPdrFiles(pyodide, backups);
        }
    }

    try {
        pyodide = await getPyodide();
        await initPDR();
        pdrLoadingModalContent.innerText = `loading ${firstFile.name}...`
        await delayNextPaint();
        await stagePdrFiles(pyodide, files, backups);
        // pdr caches products by path, so if we replaced any existing file,
        // drop the cache so the new bytes actually get parsed
        if ([...backups.values()].some((b) => b !== null)) {
            await flushPdrCache();
        }
        // pdr will usually handle figuring out whether this is a detached label
        //  or a data file, but it can become problematic if there are files
        //  in the product that don't share filename stems with a detached label
        //  and one of those is first (e.g. M3 products). The open dialog puts a
        //  lone .xml/.lbl label first and asks the user when that's ambiguous.
        const objects = await getProductInfo(firstFile.name);
        if (Object.keys(objects).length === 0) {
            showPDRErrorModal("no arrays found in file");
            await restorePrevious();
            return;
        }
        pdrProductInfo = {
            name: firstFile.name,
            objects,
            files: files.map((f) => f.name),
        };
        switched = true;
        let displayed = false;
        lockRender();
        try {
            await populatePdrUI();
            displayed = await handlePdrObjectChange();
            requestUIDraw();
            requestRender();
        } finally {
            // the renderer lock isn't reference-counted; always release it
            unlockRender();
        }
        if (!displayed) {
            // the failing step has already shown its error
            await restorePrevious();
            return;
        }
        committed = true;

        // remove the old product's files, except ones this upload reused
        for (const f of prev.files ?? []) {
            if (pdrProductInfo.files.includes(f)) continue;
            try {
                pyodide.FS.unlink(f);
            } catch {
                // already gone
            }
        }
        unlockApp();
        // not awaited: the app is usable while the label is read
        void showProductLabel(firstFile.name);
    } catch (err) {
        console.error(err);
        pdrLoadingModal.style.display = "none";
        showPDRErrorModal(err);
        if (!committed) {
            try {
                await restorePrevious();
            } catch (restoreErr) {
                console.error("restoring previous product failed:", restoreErr);
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
    // back to the start-up image
    await showDefaultPattern();
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


async function exportImage(fullImage = false, format = "png8") {
    Lock.image = true;
    try {
        const isTiff = format.startsWith("tiff");
        const bits = format === "tiff16" ? 16 : 8;
        const {pixels, w, h} = await appRenderer.createExport(
            animating ? timePhase : 0, fullImage, isTiff && bits === 16
        );
        if (isTiff) {
            const src = appRenderer.source;
            const description = JSON.stringify({
                software: "pdr-vandal",
                source_scale: src?.scale ?? null,
                source_offset: src?.offset ?? null,
                note: "Values are the displayed (stretched, effect-processed) image, not raw data.",
            });
            const {blob} = encodeTiff({
                pixels, w, h, bits, description,
                sourceBands: appRenderer.ingressBandCount() === 1 ? 1 : 3,
            });
            downloadBlob(blob, vandalStamp(activeFile[0], 'tif', exportTag()));
            return;
        }
        const imgArr = new Uint8ClampedArray(pixels.length);
        for (let i = 0; i < pixels.length; i++) {
            imgArr[i] = Math.round(pixels[i] * 255);
        }
        const imgData = new ImageData(imgArr, w, h);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").putImageData(imgData, 0, 0);
        canvas.toBlob(blob => downloadBlob(blob, vandalStamp(activeFile[0], 'png', exportTag())), "image/png")
        canvas.remove();
    } catch (err) {
        console.error("export failed", err);
        alert(`Export failed: ${err.message ?? err}`);
    } finally {
        Lock.image = false;
        requestRender();
    }
}


const isAnimationActive = () => getEffectStack().some(fx => isModulating(fx))

// An effect that would actually render animated: modulating, enabled, and
// not skipped by another effect's solo (as in GlitchRenderer.applyEffects).
function hasActiveAnimatedEffect() {
    const stack = getEffectStack();
    const anySolo = stack.some(fx => fx.solo);
    return stack.some(fx =>
        isModulating(fx) && !fx.disabled && (!anySolo || fx.solo)
    );
}

// The Freeze Animation button only means something while an effect is
// animating, so hide it (with its separator) otherwise. Its frozen state is
// kept while hidden; it is visible, and red, whenever that state matters.
const freezeAnimationGroup = gid("freezeAnimationGroup");
function updateFreezeAnimationButton() {
    freezeAnimationGroup.hidden = !hasActiveAnimatedEffect();
}

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
    if (lastCoordEvent) renderCoords(lastCoordEvent, appRenderer, coordOutput);
    histogramPanel?.scheduleUpdate(time, animating);
}


function renderImage() {
    updateFreezeAnimationButton();
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
        // Turning modulation off requests only a UI draw, so check here too.
        updateFreezeAnimationButton();
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
    histogramPanel = new HistogramPanel(appRenderer, getEffectStack);
    metadataPanel = new MetadataPanel();
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
    setupOpenFileModal({
        handleUpload: handleHTMLUpload, handlePdrUpload, lockApp, unlockApp,
        preloadPdr: preloadPDR,
    });
    setupAboutModal(lockApp, unlockApp);
    setupWindow(resizeAndRedraw);
    await showDefaultPattern();
    setupInputStretch();
    renderLoop();
    uiLoop();
    // Startup is complete (initial pattern loaded, loops running); tests
    // wait for this before driving the app.
    document.body.dataset.ready = "1";
}


await appSetup();

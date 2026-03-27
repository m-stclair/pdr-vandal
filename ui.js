import {gid} from "./utils/helpers.js";
import {
    addUserPreset,
    listAppPresets,
    getAppPresetView,
    deleteUserPreset,
    updateAppPresets,
} from "./utils/presets.js";
import {populateTestSelect} from "./test_patterns.js";
import {randomizeEffectStack} from "./utils/randomizer.js";


// pane dragging logic
const dragBar = document.getElementById("dragBar");
const leftPane = document.getElementById("leftPane");
const layout = document.getElementById("mainLayout");

export function setupPaneDrag() {
    let isDragging = false;
    const leftWidth = leftPane.getBoundingClientRect().width;
    dragBar.style.left = `${leftWidth}px`;

    dragBar.addEventListener("mousedown", (e) => {
        isDragging = true;
        document.body.style.cursor = "ew-resize";
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const layoutRect = layout.getBoundingClientRect();
        const minLeft = 100;
        const maxLeft = layoutRect.width - 200; // leave min space for rightPane

        const newLeft = Math.min(Math.max(e.clientX - layoutRect.left, minLeft), maxLeft);

        leftPane.style.flex = `0 0 ${newLeft}px`;
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = "default";
        }
    });
}

export function moveEffectInStack(effectStack, from, to) {
    if (from < 0 || from >= effectStack.length) return;
    to = Math.max(0, Math.min(to, effectStack.length));
    if (from === to) return;
    const [moved] = effectStack.splice(from, 1);
    effectStack.splice(to, 0, moved);
}


// top-level buttons
const uploadButton = gid('upload');
const uploadPDRButton = gid('pdr-upload');
// const saveBtn = gid("save-stack");
// const loadBtn = gid("load-stack");
const clearBtn = gid("clear-stack");
// const textarea = gid("stack-json");


export function setupStaticButtons(
    handleUpload, handlePdrUpload, resetStack, requestRender, requestUIDraw,
    setFreezeAnimationButtonFlag
) {
    uploadButton.addEventListener(
        'change', (e) => {
            handleUpload(e);
            uploadButton.value = "";
        });
    uploadPDRButton.addEventListener(
        'change', async (e) => {
            await handlePdrUpload(e);
            uploadPDRButton.value = "";
        });
    clearBtn.addEventListener("click", () => {
        resetStack();
        requestUIDraw();
        requestRender();
    });
    const freezeBtn = gid("freezeAnimation")
    freezeBtn.addEventListener("click",
        () => {
            freezeBtn.classList.toggle("frozen");
            setFreezeAnimationButtonFlag(freezeBtn.classList.contains("frozen"))
        }
    )
}

export function setupWindow(resizeAndRedraw) {
    window.addEventListener('resize', resizeAndRedraw);
    window.addEventListener('orientationchange', resizeAndRedraw);
}


export function placeholderOption(text = "select") {
    const nullOpt = document.createElement('option');
    nullOpt.value = ""
    nullOpt.textContent = text;
    nullOpt.selected = true;
    nullOpt.disabled = true;
    nullOpt.hidden = true;
    return nullOpt;
}
//
// function updatePresetSelect() {
//     updateAppPresets();
//     const select = document.getElementById('presetSelect');
//     select.innerHTML = '';
//
//     select.appendChild(placeholderOption("--preset--"));
//     listAppPresets().sort().forEach((name) => {
//         const opt = document.createElement('option');
//         opt.textContent = name;
//         select.appendChild(opt);
//     });
// }
//
// export function setupPresetUI(
//     getState, loadState, resetStack, requestRender, requestUIDraw, registry,
//     lockRender, unlockRender
// ) {
//
//     document.getElementById('presetSelect').addEventListener("change", async () => {
//         lockRender();
//         resetStack();
//         const name = document.getElementById('presetSelect').value;
//         if (listAppPresets().includes(name)) {
//             await loadState(getAppPresetView(name), registry, false);
//         }
//         requestUIDraw();
//         requestRender();
//         unlockRender();
//     });
//
//     document.getElementById('presetSave').onclick = () => {
//         const name = prompt('Preset name?');
//         if (!name) return;
//         const config = getState();
//         addUserPreset(name, config);
//         updateAppPresets();
//         updatePresetSelect();
//     };
//
//     document.getElementById('presetDelete').onclick = () => {
//         const name = document.getElementById('presetSelect').value;
//         deleteUserPreset(name);
//         updateAppPresets();
//         updatePresetSelect();
//     };
//     updatePresetSelect();
// }

export function setupExportImage(exportImage) {
    document.getElementById('exportImage').onclick = exportImage;
}

// export function setupVideoCapture(startCapture, stopCapture) {
//     document.getElementById('startCapture').onclick = () => startCapture();
//     document.getElementById('stopCaptureOverlay').onclick = () => stopCapture();
// }

export const pdrErrorModal = gid("pdr-error-modal");
export const pdrErrorModalContent = gid("pdr-error-modal-content");

export function setupPDRErrorModal(unlockApp) {
    const closeButton = gid("close-pdr-error-modal");
    closeButton.addEventListener("click", () => {
        pdrErrorModal.style.display = "none";
        pdrErrorModalContent.innerHTML = "";
        unlockApp();
    });
}

export function setupHelpModal(lockApp, unlockApp) {
    const helpModal = gid("help-modal");
    const helpModalOpenButton = gid("open-help-modal")
    const helpModalContent = gid("help-modal-content")
    helpModalOpenButton.addEventListener("click", () => {
        helpModal.style.display = "block";
        lockApp();
    })
    helpModalContent.addEventListener("click", (e) => e.stopPropagation());
    helpModal.addEventListener("click", () => {
        helpModal.style.display = "none";
        unlockApp();
    })
    const helpModalCloseButton = gid("close-help-modal")
    helpModalCloseButton.addEventListener("click", () => {
        helpModal.style.display = "none";
        unlockApp();
    })
}



// export function setupVideoExportModal() {
//     const modal = document.getElementById("exportControlsModal");
//     const openModalButton = document.getElementById("openExportControlsModal");
//     const closeModalButton = document.getElementById("closeExportControlsModal");
//
//     openModalButton.addEventListener("click", () => {
//         modal.style.display = "block";
//     });
//
//     closeModalButton.addEventListener("click", () => {
//         modal.style.display = "none";
//     });
//
//     window.addEventListener("click", (event) => {
//         if (event.target === modal) {
//             modal.style.display = "none";
//         }
//     });
// }

export function setupDragAndDrop(handleUpload) {
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files)
            .filter(f => f.type.startsWith('image/'));
        handleUpload(files[0]);
    });
}

function isProbablyMobile() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobileUA = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isSmallScreen = window.innerWidth < 768;
    return isMobileUA || (isTouchDevice && isSmallScreen);
}

export function pruneForMobile(exportImage, loadState, registry,
                               requestUIDraw, requestRender, startCapture) {
    if (!isProbablyMobile()) return;
    document.body.classList.add('mobile-mode');

    gid("rightPane").style.display = 'none';
    gid("leftPane").style.maxWidth = '100%';
    gid("leftPane").style.flexGrow = 1;
    gid("leftPane").style.flexShrink = 0;
    const topBar = gid("topBar");
    topBar.innerHTML = `
        <button id="startCapture" title="Download WebM">🎥</button>
        <button id="exportImage" title="Download PNG">📷</button>
        <select id="presetSelect"></select>
        <select id="test-pattern-select"></select>
        <button id="randomStack" title="Randomize">🔀</button>
        <label for="upload" title="Choose File">⬆</label>
      `;
    updatePresetSelect();
    document.getElementById('presetSelect').addEventListener("change", async () => {
        const name = document.getElementById('presetSelect').value;
        if (listAppPresets().includes(name)) {
            await loadState(getAppPresetView(name), registry, false);
        }
        requestUIDraw();
        requestRender();
    });
    document.getElementById('exportImage').onclick = () => {
        exportImage("full");
    };
    document.getElementById('startCapture').onclick = () => startCapture();
    gid("randomStack").addEventListener("click", async () => await randomizeEffectStack());
    populateTestSelect();
    gid("dragBar").remove();
    topBar.classList.add('mobile');
    gid("mainLayout").style.maxHeight = "80vh";
    gid("mobile-topbar-target").appendChild(topBar);
}


// "Open file" dialog: drag-and-drop (or Browse…) into a modal. In PDR mode,
// files are staged (all at once or one at a time, e.g. a data file and its
// detached label) and opened together on "Open". Files dropped on the main
// window are routed: a lone desktop image goes to the browser reader,
// anything else opens the PDR dialog with those files staged.

const LABEL_RE = /\.(xml|lbl)$/i;
const DESKTOP_IMAGE_RE = /\.(png|jpe?g|webp)$/i;

/**
 * Which staged file PDR should read first. A single label candidate (or a
 * single file) is unambiguous; otherwise the user should choose.
 * @param {string[]} names
 * @returns {{index: number, ambiguous: boolean}}
 */
export function pickPrimary(names) {
    const candidates = names.flatMap((n, i) => (LABEL_RE.test(n) ? [i] : []));
    if (names.length <= 1 || candidates.length === 1) {
        return {index: candidates.length === 1 ? candidates[0] : 0, ambiguous: false};
    }
    return {index: candidates.length ? candidates[0] : 0, ambiguous: true};
}

/**
 * Where files dropped on the main window go.
 * @param {string[]} names
 * @returns {"browser" | "pdr"}
 */
export function routeWindowDrop(names) {
    return names.length === 1 && DESKTOP_IMAGE_RE.test(names[0]) ? "browser" : "pdr";
}

const gid = (id) => document.getElementById(id);

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// Files from a drop, minus directories (which must be checked while the
// drop event is being dispatched). Each file is taken from its own item:
// dataTransfer.files skips non-file items, so its indexes need not match.
function filesFromDrop(dataTransfer) {
    if (!dataTransfer.items) return {files: Array.from(dataTransfer.files), skipped: []};
    const files = [], skipped = [];
    for (const item of Array.from(dataTransfer.items)) {
        if (item.kind !== "file") continue;
        const f = item.getAsFile();
        if (!f) continue;
        if (item.webkitGetAsEntry?.()?.isDirectory) skipped.push(f.name);
        else files.push(f);
    }
    return {files, skipped};
}

const isAnyModalOpen = () =>
    Array.from(document.querySelectorAll(".modal")).some((m) => m.style.display === "block");

export function setupOpenFileModal({handleUpload, handlePdrUpload, lockApp, unlockApp}) {
    const modal = gid("open-file-modal");
    const content = gid("open-file-modal-content");
    const title = gid("open-file-title");
    const dropZone = gid("drop-zone");
    const pdrInput = gid("pdr-upload");
    const browserInput = gid("upload");
    const pdrControls = gid("pdr-controls");
    const list = gid("staged-list");
    const hint = gid("primary-hint");
    const leftoverNote = gid("leftover-note");
    const message = gid("open-file-message");
    const openButton = gid("open-staged");

    let mode = "pdr";
    let staged = [];
    let userPrimary = null;     // name of a file the user picked as primary
    let leftover = new Set();   // staged files from an earlier visit
    let loading = false;

    const isOpen = () => modal.style.display === "block";
    const setMessage = (text) => { message.textContent = text; };

    function primaryIndex() {
        const names = staged.map((f) => f.name);
        const picked = names.indexOf(userPrimary);
        const auto = pickPrimary(names);
        // when ambiguous, the user must choose; index is -1 until they do
        return {index: auto.ambiguous ? picked : auto.index, ambiguous: auto.ambiguous};
    }

    function render() {
        list.replaceChildren();
        const {index, ambiguous} = primaryIndex();
        hint.hidden = !ambiguous;
        staged.forEach((f, i) => {
            const li = document.createElement("li");
            const label = document.createElement("label");
            if (ambiguous) {
                const radio = document.createElement("input");
                radio.type = "radio";
                radio.name = "primary-file";
                radio.checked = i === index;
                radio.addEventListener("change", () => { userPrimary = f.name; render(); });
                label.append(radio);
            }
            const name = document.createElement("span");
            name.className = "staged-name";
            name.textContent = f.name;
            label.append(name);
            if (!ambiguous && i === index && staged.length > 1) {
                const tag = document.createElement("span");
                tag.className = "primary-tag";
                tag.textContent = "primary";
                label.append(tag);
            }
            const size = document.createElement("span");
            size.className = "staged-size";
            size.textContent = formatSize(f.size);
            const remove = document.createElement("button");
            remove.className = "staged-remove";
            remove.textContent = "×";
            remove.setAttribute("aria-label", `Remove ${f.name}`);
            remove.addEventListener("click", () => {
                staged = staged.filter((s) => s !== f);
                render();
            });
            li.append(label, size, remove);
            list.append(li);
        });
        const nLeftover = staged.filter((f) => leftover.has(f)).length;
        leftoverNote.hidden = nLeftover === 0;
        leftoverNote.textContent = `${nLeftover} file(s) from earlier`;
        openButton.disabled = staged.length === 0 || index < 0;
    }

    function addFiles(files, skipped = []) {
        const notes = skipped.map((n) => `Skipped folder ${n}.`);
        for (const f of files) {
            const existing = staged.findIndex((s) => s.name === f.name);
            if (existing >= 0) {
                staged[existing] = f;
                notes.push(`Replaced ${f.name}.`);
            } else {
                staged.push(f);
            }
        }
        setMessage(notes.join(" "));
        render();
    }

    function openBrowserFile(files) {
        if (files.length !== 1 || !DESKTOP_IMAGE_RE.test(files[0].name)) {
            setMessage("Open With Browser takes a single PNG, JPEG or WebP image. " +
                "Use Open With PDR for other files.");
            return;
        }
        closeDialog();
        handleUpload(files[0]);
    }

    function openDialog(newMode, extraFiles = [], skipped = []) {
        if (!isOpen()) {
            mode = newMode;
            leftover = new Set(staged);
            setMessage("");
            title.textContent = mode === "pdr" ? "Open With PDR" : "Open With Browser";
            dropZone.textContent = mode === "pdr"
                ? "Drop file(s) here: a data file, its label, or both"
                : "Drop a PNG, JPEG or WebP image here";
            pdrControls.hidden = mode !== "pdr";
            modal.style.display = "block";
            lockApp();
            dropZone.focus();
        }
        if (mode === "pdr") addFiles(extraFiles, skipped);
        else render();
    }

    function closeDialog() {
        modal.style.display = "none";
        dropZone.classList.remove("dragover");
        unlockApp();
    }

    function clearStaged() {
        staged = [];
        userPrimary = null;
        leftover = new Set();
        setMessage("");
        render();
    }

    async function openStaged() {
        if (staged.length === 0) return;
        const {index} = primaryIndex();
        if (index < 0) {
            setMessage("Choose the primary file first.");
            return;
        }
        const files = [staged[index], ...staged.filter((_, i) => i !== index)];
        clearStaged();
        closeDialog();
        loading = true;
        try {
            await handlePdrUpload(files);
        } finally {
            loading = false;
        }
    }

    const browse = () => (mode === "pdr" ? pdrInput : browserInput).click();

    // top-bar buttons and dialog controls
    gid("open-pdr-dialog").addEventListener("click", () => openDialog("pdr"));
    gid("open-browser-dialog").addEventListener("click", () => openDialog("browser"));
    gid("browse-files").addEventListener("click", browse);
    dropZone.addEventListener("click", browse);
    gid("close-open-file-modal").addEventListener("click", closeDialog);
    gid("cancel-open-file").addEventListener("click", closeDialog);
    gid("clear-staged").addEventListener("click", clearStaged);
    openButton.addEventListener("click", openStaged);
    modal.addEventListener("click", closeDialog);
    content.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isOpen()) closeDialog();
    });
    dropZone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            browse();
        }
    });

    pdrInput.addEventListener("change", () => {
        addFiles(Array.from(pdrInput.files));
        pdrInput.value = "";
    });
    browserInput.addEventListener("change", () => {
        const files = Array.from(browserInput.files);
        browserInput.value = "";
        openBrowserFile(files);
    });

    // drops anywhere on the dialog box count; the drop zone shows it
    let zoneDepth = 0;
    content.addEventListener("dragenter", () => {
        zoneDepth++;
        dropZone.classList.add("dragover");
    });
    content.addEventListener("dragleave", () => {
        if (--zoneDepth <= 0) {
            zoneDepth = 0;
            dropZone.classList.remove("dragover");
        }
    });
    content.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    });
    content.addEventListener("drop", (e) => {
        e.preventDefault();
        zoneDepth = 0;
        dropZone.classList.remove("dragover");
        const {files, skipped} = filesFromDrop(e.dataTransfer);
        if (mode === "pdr") addFiles(files, skipped);
        else openBrowserFile(files);
    });

    // drops on the main window. Always prevent the default, which would
    // navigate the tab to the dropped file and lose the session.
    const acceptsWindowDrop = () => !loading && !isAnyModalOpen();
    let windowDepth = 0;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    document.addEventListener("dragenter", (e) => {
        windowDepth++;
        if (hasFiles(e) && acceptsWindowDrop()) document.body.classList.add("drag-target");
    });
    document.addEventListener("dragleave", () => {
        if (--windowDepth <= 0) {
            windowDepth = 0;
            document.body.classList.remove("drag-target");
        }
    });
    document.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!content.contains(e.target) && !acceptsWindowDrop()) {
            e.dataTransfer.dropEffect = "none";
        }
    });
    document.addEventListener("drop", (e) => {
        e.preventDefault();
        windowDepth = 0;
        document.body.classList.remove("drag-target");
        // drops inside the dialog are handled above (which may already have
        // closed it); ignore the rest while any modal is open or a product
        // is loading
        if (content.contains(e.target) || !acceptsWindowDrop()) return;
        const {files, skipped} = filesFromDrop(e.dataTransfer);
        if (files.length === 0) return;
        if (routeWindowDrop(files.map((f) => f.name)) === "browser") handleUpload(files[0]);
        else openDialog("pdr", files, skipped);
    });

    render();
}

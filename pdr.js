import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.mjs";
// pinned pdr[pillow,fits] and its dependencies; regenerate with
// tools/pin_pdr_wheels.py (which reads the Pyodide version above)
import { PDR_PACKAGES } from "./pdr-packages.js";

export let pdrInitializedFlag = false;
export let pdrInitializingFlag = false;

let pyodidePromise = null;

const pyodideLoadOpts = {
    stdout: (msg) => console.log("[py]", msg),
    stderr: (msg) => console.error("[py err]", msg),
    // Loading the packages here, rather than with micropip afterwards,
    // downloads them alongside the interpreter and skips micropip's PyPI
    // lookups: ~1-2 s faster on a first open.
    packages: PDR_PACKAGES,
}

export function getPyodide() {
    if (pyodidePromise === null) {
        pyodidePromise = (async () => {
            const pyodide = await loadPyodide(pyodideLoadOpts);

            pyodide.setStdout({
                batched: (msg) => console.log("[py]", msg),
            });
            pyodide.setStderr({
                batched: (msg) => console.error("[py err]", msg),
            });

            return pyodide;
        })().catch((err) => {
            pyodidePromise = null; // allow retry after failure
            throw err;
        });
    }

    return pyodidePromise;
}


async function fetchPdrview() {
    const response = await fetch("pdrview.py");
    if (!response.ok) {
        throw new Error(`could not fetch pdrview.py: HTTP ${response.status}`);
    }
    return response.text();
}

// The packages are already loaded by getPyodide(); this runs our Python.
export async function installPDR(pdrviewSource = fetchPdrview()) {
    if (pdrInitializedFlag) return;
    const pyodide = await getPyodide();
    console.log("prepping local python...");
    await pyodide.runPythonAsync(await pdrviewSource);
    // pdrview imports these lazily; importing them now, during init (which
    // may be a preload), takes ~0.4 s off the first FITS or desktop image
    pyodide.runPython("from astropy.io import fits\nfrom PIL import Image");
}

let pdrInitPromise = null;

export function initPDR() {
    if (pdrInitializedFlag) {
        return Promise.resolve();
    }

    if (pdrInitPromise !== null) {
        return pdrInitPromise;
    }

    console.log("fetching pyodide...");
    pdrInitializingFlag = true;

    pdrInitPromise = (async () => {
        // fetch pdrview.py while Pyodide boots; catch it here so a failed
        // fetch can't reject unobserved if getPyodide() fails first
        const pdrviewSource = fetchPdrview();
        pdrviewSource.catch(() => {});
        await getPyodide();
        await installPDR(pdrviewSource);
        await setUpInterface();

        pdrInitializedFlag = true;
        console.log("ready!");
    })()
    .catch((err) => {
        pdrInitializedFlag = false;
        throw err;
    })
    .finally(() => {
        pdrInitializingFlag = false;
        pdrInitPromise = null;
    });

    return pdrInitPromise;
}

// Start initializing in the background, e.g. when the PDR open dialog
// appears, so the user isn't kept waiting once they pick a file. A failure is
// only a warning: the real open calls initPDR() again, which retries and
// reports the error.
export function preloadPDR() {
    if (pdrInitializedFlag) return;
    initPDR().catch((err) => console.warn("PDR preload failed:", err));
}

const py = {
    initialized: false,
    fns: {}
};

function requirePdrInterfaceInit() {
    if (!py.initialized) {
        throw new Error("PDR Python function interface not initialized");
    }
}

// geometry: optional JSON string of pdrview.Geometry fields
export async function getArrayImage(path, objname, band, geometry = null) {
    requirePdrInterfaceInit();
    // never pass JS null: Pyodide hands it to Python as jsnull, not None
    const arrayData = await py.fns.get_array_image(path, objname, band, geometry ?? "");
    if (!arrayData.ok) {
        throw new Error(arrayData.error);
    }
    return arrayData;
}

export async function flushPdrCache() {
    requirePdrInterfaceInit();
    const result = await py.fns.flush_cache();
    if (!result.ok) {
        throw new Error(result.error);
    }
}


export async function getProductInfo(path) {
    requirePdrInterfaceInit();
    const result = await py.fns.get_product_info(path);
    if (!result.ok) {
        throw new Error(result.error);
    }
    return JSON.parse(result.objects);
}

// The product's labels and headers for the metadata pane:
// {sections: [{kind, title, tree, raw, error}, ...]}, or null when it has
// none (pdrview.get_product_label).
export async function getProductLabel(path) {
    requirePdrInterfaceInit();
    const result = await py.fns.get_product_label(path);
    if (!result.ok) {
        throw new Error(result.error);
    }
    const sections = JSON.parse(result.sections);
    return sections.length ? {sections} : null;
}

export async function setUpInterface() {
    const pyodide = await getPyodide();

    const names = [
        "get_array_image", "get_product_info", "get_product_label", "flush_cache"
    ];

    for (const name of names) {
        const fn = pyodide.globals.get(name);
        if (!fn) {
            throw new Error(`Missing Python function: ${name}`);
        }
        py.fns[name] = fn;
    }
    py.initialized = true;
}

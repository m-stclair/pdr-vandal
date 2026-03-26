import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.mjs";

export let pdrInitializedFlag = false;
export let pdrInitializingFlag = false;

let pyodide = null;

const pyodideLoadOpts = {
    stdout: (msg) => console.log("[py]", msg),
    stderr: (msg) => console.error("[py err]", msg),
}

export async function getPyodide() {
    if (pyodide === null) {
        pyodide = await loadPyodide(pyodideLoadOpts);
        pyodide.setStdout({
          batched: (msg) => console.log("[py]", msg),
        });
        pyodide.setStderr({
          batched: (msg) => console.error("[py err]", msg),
        });
    }
    return pyodide;
}

export async function installPDR() {
    if (pdrInitializedFlag) return;
    const pyodide = await getPyodide();
    console.log("preparing micropip...");
    await pyodide.loadPackage("micropip");
    // micropip prints its own logs
    await pyodide.runPythonAsync(`
        import micropip
        await micropip.install("pdr[pillow,fits]") 
    `);
    console.log("prepping local python...");
    await pyodide.runPythonAsync(await (await fetch("pdrview.py")).text());
}

export async function initPDR() {
    if (pdrInitializedFlag || pdrInitializingFlag) return;
    console.log("fetching pyodide...");
    pdrInitializingFlag = true;
    await getPyodide();
    await installPDR();
    await setUpInterface();
    pdrInitializingFlag = false;
    pdrInitializedFlag = true;
    console.log("ready!");
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

export async function getArrayImage(path, objname, band) {
    requirePdrInterfaceInit();
    const arrayData = await py.fns.get_array_image(path, objname, band);
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

export async function setUpInterface() {
    const pyodide = await getPyodide();

    const names = ["get_array_image", "get_product_info", "flush_cache"];

    for (const name of names) {
        const fn = pyodide.globals.get(name);
        if (!fn) {
            throw new Error(`Missing Python function: ${name}`);
        }
        py.fns[name] = fn;
    }
    py.initialized = true;
}

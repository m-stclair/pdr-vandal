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

    const names = ["get_array_image", "get_product_info"];

    for (const name of names) {
        const fn = pyodide.globals.get(name);
        if (!fn) {
            throw new Error(`Missing Python function: ${name}`);
        }
        py.fns[name] = fn;
    }
    py.initialized = true;
}

//
// function padRGBToRGBA(rgb, width, height) {
//     const len = width * height * 3;
//     if (rgb.length !== len) {
//         throw new Error(`Expected ${len} pixels, got ${rgb.length}`);
//     }
//     const rgba = new Uint8Array(len * 4 / 3);
//     for (let i = 0; i < len / 3; i++) {
//         const j = i * 4;
//         rgba[j] = rgb[i * 3]
//         rgba[j + 1] = rgb[i * 3 + 1];
//         rgba[j + 2] = rgb[i * 3 + 2];
//         rgba[j + 3] = 255;
//     }
//     return rgba
// }
//
// function padGrayscaleToRGBA(gray, width, height) {
//     const len = width * height;
//     if (gray.length !== len) {
//         throw new Error(`Expected ${len} pixels, got ${gray.length}`);
//     }
//
//     const rgba = new Uint8Array(len * 4);
//     for (let i = 0; i < len; i++) {
//         const v = gray[i];
//         const j = i * 4;
//         rgba[j] = v;     // R
//         rgba[j + 1] = v; // G
//         rgba[j + 2] = v; // B
//         rgba[j + 3] = 255; // A
//     }
//     return rgba;
// }

//     await pyodide.runPythonAsync(`load_product("${file.name}")`);
//     const dataJSON = await pycall(`describe_data("${file.name}")`);
//     logDebug(`Loaded ${dataJSON} from Python`);
//     const data = JSON.parse(dataJSON);
//     logDebug(`Converted to ${data}`);
//     const container = document.getElementById("data-explorer");
//     container.innerHTML = "";
//     createDataExplorer(container, data);
//     // await pyodide.runPythonAsync(`arr = get_array_for_js("${file.name}", "${Object.keys(data.objects)[0]}")`);
//     // const arrJs = pyodide.globals.get("arr").toJs();
//     // console.log(arrJs)
//     // renderGrayscaleToCanvas(arrJs);
//     initWebGL();
//     const obj = Object.keys(data.objects)[0];
//     const result = await pycall(`get_array_object_normalized("${file.name}", "${obj}")`);
//     const [arrProxy, shape] = result.toJs({ dict_converter: Object });
//     const flat = arrProxy;
//     const gray = flat instanceof Uint8Array ? flat : Uint8Array.from(flat);
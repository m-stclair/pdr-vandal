import { loadShaderManifest } from './manifestLoader.js';

const manifest = await loadShaderManifest();

export const UniformSetters = {
    float: (gl, loc, val) => gl.uniform1f(loc, val),
    int: (gl, loc, val) => gl.uniform1i(loc, val),
    bool: (gl, loc, val) => gl.uniform1i(loc, val ? 1 : 0),
    vec2: (gl, loc, val) => gl.uniform2fv(loc, val),
    vec3: (gl, loc, val) => gl.uniform3fv(loc, val),
    vec4: (gl, loc, val) => gl.uniform4fv(loc, val),
    mat2: (gl, loc, val) => gl.uniformMatrix2fv(loc, false, val),
    mat3: (gl, loc, val) => gl.uniformMatrix3fv(loc, false, val),
    mat4: (gl, loc, val) => gl.uniformMatrix4fv(loc, false, val),
    intArray: (gl, loc, val) => gl.uniform1iv(loc, val),
    floatArray: (gl, loc, val) => gl.uniform1fv(loc, val),
    vec2Array: (gl, loc, val) => gl.uniform2fv(loc, val),
    vec3Array: (gl, loc, val) => gl.uniform3fv(loc, val),
    vec4Array: (gl, loc, val) => gl.uniform4fv(loc, val),
    texture2D: (gl, loc, val) => gl.uniform1i(loc, val)
};

export function checkFrameBuffer(gl) {
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`could not construct framebuffer, status ${status}`)
    }
}

export function checkTexture(gl, tex) {
    if (!gl.isTexture(tex)) {
        throw new Error("invalid texture")
    }
}

export function initGLEffect(instance, fragSource) {
    if (!instance.glState) {
        throw new Error("Can't call apply() before assigning a webGLState")
    }
    if (!instance.glState.fragSrc) {
        instance.glState.fragSrc = fragSource.src;
    }
    if (!instance.glState.includeMap) {
        instance.glState.includeMap = fragSource.includeMap;
    }
}

// TODO: some bug somewhere related to bareword substitution
function _preprocessGLSL(source, defines, includeMap) {
    const lines = source.split('\n');
    const output = [];
    const stack = [];
    let skipping = false;
    for (let i = 0; i < lines.length; i++) {
        let rawLine = lines[i];
        let line = rawLine.trim();
        if (line.startsWith('#define ')) {
            const [_, key, val] = line.match(/^#define\s+(\w+)\s+([^\/]+)/) || [];
            if (!key) continue;
            if (defines[key] !== undefined) {
                continue;
            }
            defines[key] = val || '1';
            continue;
        }
        if (line.startsWith('#undef ')) {
            const key = line.split(/\s+/)[1];
            delete defines[key];
            continue;
        }
        if (line.startsWith('#ifdef ')) {
            const key = line.split(/\s+/)[1];
            const cond = key in defines;
            stack.push({skipping, branchTaken: cond});
            skipping = skipping || !cond;
            continue;
        }
        if (line.startsWith('#ifndef ')) {
            const key = line.split(/\s+/)[1];
            const cond = !(key in defines);
            stack.push({skipping, branchTaken: cond});
            skipping = skipping || !cond;
            continue;
        }
        if (line.startsWith('#if ')) {
            const expr = line.slice(4).replace(
                /\b([A-Za-z_][A-Za-z0-9_]*)\b/g,
                k => (defines.hasOwnProperty(k) ? defines[k] : '0')
            );
            let cond = false;
            try {
                cond = !!eval(expr);
            } catch {
            }
            stack.push({skipping, branchTaken: cond});
            skipping = skipping || !cond;
            continue;
        }
        if (line.startsWith('#elif ')) {
            if (!stack.length) throw new Error(`#elif without #if at line ${i + 1}`);
            const top = stack[stack.length - 1];
            if (top.branchTaken || top.skipping) {
                skipping = true;
                continue;
            }
            const expr = line.slice(6).replace(
                /\b([A-Za-z_][A-Za-z0-9_]*)\b/g,
                k => (defines.hasOwnProperty(k) ? defines[k] : '0')
            );
            let cond = false;
            try {
                cond = !!eval(expr);
            } catch {
            }
            top.branchTaken = cond;
            skipping = !cond;
            continue;
        }
        if (line.startsWith('#else')) {
            if (!stack.length) throw new Error(`#else without #if at line ${i + 1}`);
            const top = stack[stack.length - 1];
            skipping = top.skipping || top.branchTaken;
            top.branchTaken = true;
            continue;
        }
        if (line.startsWith('#endif')) {
            if (!stack.length) throw new Error(`#endif without #if at line ${i + 1}`);
            const top = stack.pop();
            skipping = top.skipping;
            continue;
        }
        if (line.startsWith('#include ')) {
            if (skipping) continue;
            const match = line.match(/#include\s+"(.+?)"/);
            if (!match) throw new Error(`Invalid #include: ${line}`);
            const file = match[1];
            if (!(file in includeMap)) throw new Error(`Missing include: ${file}`);
            const included = _preprocessGLSL(includeMap[file], defines, includeMap);
            output.push(included);
            continue;
        }
        if (!skipping) {
            const processed = rawLine.replace(/\b(\w+)\b/g, k => defines[k] ?? k);
            output.push(processed);
        }
    }
    return output.join('\n');
}

export function preprocessGLSL(source, options = {}) {
    const includeMap = options.includeMap || {};
    const defines = options.defines || {}; // <-- do NOT clone here
    return _preprocessGLSL(source, defines, includeMap);
}

export function loadFragSrcInit(shaderPath, includePaths) {
    let shader = null;
    let includeMap = null;

    async function load() {
        const fragURL = new URL(`../build/shaders/${manifest[shaderPath]}`, import.meta.url);
        const sresp = await fetch(fragURL);
        if (!sresp.ok) throw new Error(`Failed to load shader: ${fragURL}`);
        shader = await sresp.text();
        if (includePaths) {
            includeMap = {};
            Object.entries(includePaths).map(([name, path]) => {
                const url = new URL(`../build/shaders/${manifest[path]}`, import.meta.url);
                includeMap[name] = fetch(url);
            })
            for (const [name, promise] of Object.entries(includeMap)) {
                const resp = await promise;
                if (!resp.ok) throw new Error(`Failed to load shader: ${name}`);
                includeMap[name] = await resp.text();
            }
        }
    }

    return {
        // just little closures
        get src() {
            return shader;
        },
        get includeMap() {
            return includeMap;
        },
        load
    }
}
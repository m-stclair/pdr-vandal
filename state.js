import {gid, uuidv4} from "./utils/helpers.js";
import {normalizeImageData} from "./utils/imageutils.js";
import {webGLState} from "./utils/webgl_state.js";
import {GlitchRenderer} from "./utils/glitch_renderer.js"
import {effectRegistry} from "./registry.js";


export const Dirty = {image: true, ui: true}
export const Lock = {image: false, ui: false}
export const requestRender = () => Dirty.image = true;
export const requestUIDraw = () => Dirty.ui = true;
export const requestRedraw = () => {
    Dirty.image = true;
    appRenderer.inputDirty = true;
}

// shared rendering objects
export const canvas = document.getElementById('glitchCanvas');
canvas.style.willChange = 'transform';
export const defaultCtx = canvas.getContext("webgl2", { alpha: false, antialias: true });

export const appRenderer = new GlitchRenderer(defaultCtx);
export function clearRenderCache() {
    appRenderer.renderCache.clear();
}

export const activeFile = [];

canvas.addEventListener(
    "wheel", (e) => {
        e.preventDefault();
        appRenderer.setZoom(e.deltaY);
        requestRender();
    },
    { passive: false }
)

class PanInterface {
    constructor(pannable) {
        this.pannable = pannable;
        this.lastPointerX = null;
        this.lastPointerY = null;
        this.isDragging = false;
    }

    onPointerDown = (e) => {
        this.isDragging = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        e.target.setPointerCapture?.(e.pointerId);
    };

    onPointerMove = (e) => {
        if (!this.isDragging) return;

        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;

        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;

        this.pannable.panByPixels(dx, -dy);

        requestRender();
    };

    onPointerUp = (e) => {
        this.isDragging = false;
        e.target.releasePointerCapture?.(e.pointerId);
    };
}

const panInterface = new PanInterface(appRenderer);

canvas.addEventListener("pointerdown", panInterface.onPointerDown);
canvas.addEventListener("pointermove", panInterface.onPointerMove);
canvas.addEventListener("pointerup", panInterface.onPointerUp);
canvas.addEventListener("pointercancel", panInterface.onPointerUp);


let effectStack = [];

let selectedEffectId = "none";

export function getSelectedEffectId() {
    return selectedEffectId;
}

export function toggleEffectSelection(fx) {
    if (selectedEffectId === fx.id) {
        selectedEffectId = "none";
    } else {
        selectedEffectId = fx.id;
    }
}

export function isSelectedEffect(fx) {
    return selectedEffectId === fx.id;
}

export function getEffectById(id) {
    const matches = effectStack.filter((fx) => fx.id === id);
    if (matches.length === 0) return null;
    if (matches.length > 1) throw new Error("Duplicate effect ids");
    return matches[0];
}

export function forEachEffect(cb) {
    return effectStack.forEach(cb);
}

export function getActiveEffects() {
    const soloed = effectStack.find(fx => fx.solo);
    if (soloed) return [soloed];
    return effectStack.filter(fx => !fx.disabled);
}

export function forEachActiveEffect(cb) {
    return getActiveEffects().forEach(cb);
}


export function filterEffectStack(func) {
    effectStack = effectStack.filter(func);
}

let freezeAnimationFlag = false;
let freezeAnimationButtonFlag = false;
export const getAnimationFrozen = () => {
    return freezeAnimationFlag || freezeAnimationButtonFlag;
}
export const setFreezeAnimationFlag = (v) => freezeAnimationFlag = v;
export const setFreezeAnimationButtonFlag = (v) => {
    freezeAnimationButtonFlag = v;
}


export function flushEffectStack() {
    forEachEffect(
        (fx) => {
            if (fx.pinned) {

            } else if (fx.cleanupHook) {
                fx.cleanupHook(fx);
            }
        })
    effectStack.length = 0;
    // never get rid of the singleton input stretch
    addEffectToStack(inputStretchEffect);
}

export function addEffectToStack(fx) {
    if (!fx) return;
    effectStack.push(fx);
}

export function getEffectStack() {
    return effectStack;
}


// canvas property modification
export function setFilters(filters, cvs=canvas) {
    cvs.style.filter = filters;
}

export function makeEffectInstance(mod) {
    if (!mod) return Promise.resolve();
    let instance = {
        id: uuidv4(),
        name: mod.name,
        config: structuredClone(mod.defaultConfig),
        uiLayout: mod.uiLayout,
        disabled: false,
        styleHook: mod.styleHook,
        cleanupHook: mod.cleanupHook,
        apply: mod.apply,
        label: mod.name,
        solo: false,
        isGPU: mod.isGPU
    }
    if (mod.isGPU) {
        instance.glState = new webGLState(appRenderer, mod.name, instance.id)
    }
    const hook = mod.initHook?.(instance, appRenderer);
    instance.ready = hook?.then ? hook : Promise.resolve();
    return instance;
}

export const inputStretchEffect = makeEffectInstance(effectRegistry['Input Stretch']);
await inputStretchEffect.ready;
inputStretchEffect.pinned = true;

// state save/load

export function saveState() {
    return getEffectStack().map(effect => ({
        name: effect.name,
        config: { ...effect.config }
    }))
}

export async function loadState(preset, registry, fromJSON=true) {
    if (fromJSON) {
        try {
            preset = JSON.parse(preset);
        } catch (err) {
            alert(`Failed to load effect: ${err}.`);
            return;
        }
    } else {
        preset = preset.config;
    }
    for (const { name, config } of preset) {
        const mod = registry[name];
        if (!mod) {
            console.warn(`Unknown effect: ${name}`);
            continue;
        }
        const instance = makeEffectInstance(mod);
        instance.config = { ...mod.defaultConfig, ...config };
        await instance.ready;
        addEffectToStack(instance);
    }
}


function DefaultDict(defaultFactory) {
  return new Proxy({}, {
    get(target, prop) {
      if (!(prop in target)) {
        target[prop] = defaultFactory();
      }
      return target[prop];
    }
  });
}

function NestingDictFactory() {
    return () => DefaultDict(NestingDictFactory());
}

function NestingDict() {
    return DefaultDict(NestingDictFactory());
}

export const uiState = NestingDict();

export function resizeAndRedraw() {
    Lock.image = true;
    try {
        const leftPane = document.getElementById('leftPane');
        const width = leftPane.clientWidth - 20;
        const height = window.innerHeight * 0.9;
        canvas.width = width;
        canvas.height = height;
        appRenderer.inputDirty = true;
        requestRender();
    } finally {
        Lock.image = false;
    }
}


export function resetStack() {
    appRenderer.reset_pipeline();
    flushEffectStack();
    requestUIDraw();
}

export function lockRender() {
    appRenderer.lock();
}

export function unlockRender() {
    appRenderer.unlock();
}
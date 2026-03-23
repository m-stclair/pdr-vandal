// presets.js

import {assertHas} from "./helpers.js";
import {builtInPresets} from "../presets/app.js";

const STORAGE_PREFIX = 'pdr-vandal';

function lsKey(...parts) {
    return [STORAGE_PREFIX, ...parts].join(':');
}


// ─── App-Wide Effect Stack Presets ─────────────────────────────────────────────

function loadUserPresets() {
    const presets = {};
    for (let i = 0; i < localStorage.length;
         i++
    ) {
        const key = localStorage.key(i);
        if (!key.startsWith(lsKey('app', 'presets'))) continue;
        try {
            const preset = JSON.parse(localStorage.getItem(key));
            presets[preset.name] = preset;
        } catch {
            console.warn(`Invalid app preset: ${key}`);
        }
    }
    return presets;
}

function addUserPreset(name, config) {
    const key = lsKey('app', 'presets', name);
    localStorage.setItem(key, JSON.stringify({name, config}));
}

function deleteUserPreset(name) {
    localStorage.removeItem(lsKey('app', 'presets', name));
}

let appPresets;

function updateAppPresets() {
    appPresets = loadUserPresets();
    builtInPresets.forEach((p) => appPresets[p.name] = p)
}

updateAppPresets();

function getAppPresetView(presetName) {
    const preset = appPresets[presetName];
    if (!preset) return {};
    return structuredClone(preset);
}

function listAppPresets() {
    return Object.keys(appPresets);
}


// ─── Per-Effect Config Presets ─────────────────────────────────────────────────

function loadAllEffectPresets() {
    const all = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key.startsWith(lsKey('app', 'plugins'))) continue;

        const parts = key.split(':');
        const [_prefix, _scope, domain, effectName, section, ...rest] = parts;

        if (domain !== 'plugins' || section !== 'presets') continue;
        const label = rest.join(':');
        try {
            const config = JSON.parse(localStorage.getItem(key));
            if (!all[effectName]) all[effectName] = {};
            all[effectName][label] = config;
        } catch {
            console.warn(`Could not parse effect preset ${key}`);
        }
    }
    return all;
}

const effectPresets = loadAllEffectPresets();

function saveEffectPreset(effectName, label, config) {
    const key = lsKey('app', 'plugins', effectName, 'presets', label);
    localStorage.setItem(key, JSON.stringify(config));
    if (!effectPresets[effectName]) effectPresets[effectName] = {};
    effectPresets[effectName][label] = config;
}


function deleteEffectPreset(effectName, label) {
    const key = lsKey('app', 'plugins', effectName, 'presets', label);
    localStorage.removeItem(key);
    if (effectPresets[effectName]) {
        delete effectPresets[effectName][label];
    }
}

function getEffectPresetsView(effectName) {
    const presets = effectPresets[effectName];
    if (!presets) return {};

    return Object.fromEntries(
        Object.entries(presets).map(([label, config]) => [label, structuredClone(config)])
    );
}

function listEffectPresets(effectName) {
    return Object.keys(effectPresets[effectName] || {});
}

function getEffectPresetView(effectName, presetName) {
    const presets = assertHas(effectPresets, effectName, "effect preset load");
    const preset = assertHas(presets, presetName, "effect preset load");
    return structuredClone(preset);
}


export {
    loadUserPresets,
    addUserPreset,
    deleteUserPreset,
    listAppPresets,
    getEffectPresetView,
    getAppPresetView,
    updateAppPresets,
    saveEffectPreset,
    getEffectPresetsView,
    listEffectPresets,
    deleteEffectPreset
};


// console.log("app presets")
// console.log(appPresets)

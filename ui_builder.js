import widgets, {renderFoldoutToggle} from "./widgets.js"
import {moveEffectInStack, placeholderOption} from "./ui.js";
import {
    clearRenderCache,
    getSelectedEffectId,
    isSelectedEffect,
    makeEffectInstance,
    requestRender,
    requestUIDraw,
    toggleEffectSelection
} from "./state.js";
import {effectRegistry} from "./registry.js";
import {
    getEffectPresetView, listEffectPresets, saveEffectPreset
} from "./utils/presets.js";


function collectVisibilityDrivers(configArray, keyTriggersUIDraw) {
    for (const item of configArray) {
        const clauses = Array.isArray(item.showIf) ? item.showIf : [item.showIf];
        for (const clause of clauses) {
            if (clause?.key) keyTriggersUIDraw.add(clause.key);
        }
        if (item.children) collectVisibilityDrivers(item.children, keyTriggersUIDraw);
    }
}


function shouldRender(item, config) {
    if (!item.showIf) return true;

    const clauses = Array.isArray(item.showIf) ? item.showIf : [item.showIf];

    return clauses.every(({key, equals, notEquals}) => {
        const value = config[key];
        if (equals !== undefined) return value === equals || Number.parseInt(value) === equals;
        if (notEquals !== undefined) {
            if (notEquals === Number.parseInt(value)) return false;
            return value !== notEquals;
        }
        return true;
    });
}

function buildWidget(instance, uiSpec, fxUIState, drawTriggers) {
    const {type, key} = uiSpec;
    const config = instance.config;
    let widget, foldout = null;
    switch (type.toLowerCase()) {
        case 'range':
            [widget, foldout] = widgets.makeSlider(instance.id, config, uiSpec, fxUIState);
            break;
        case 'modslider':
            [widget, foldout] = widgets.makeSlider(instance.id, config, uiSpec, fxUIState, true);
            break;
        case 'matrix':
            widget = widgets.makeMatrixSlider(instance.id, config, uiSpec, fxUIState)
            break;
        case 'select':
            widget = widgets.Select(instance.id, config, uiSpec, fxUIState);
            break;
        case 'checkbox':
            widget = widgets.Checkbox(instance.id, config, uiSpec, fxUIState);
            break;
        case 'referenceimage':
            widget = widgets.ReferenceImage(instance.id, config, uiSpec, instance, fxUIState);
            break;
        case 'vector':
            widget = widgets.makeVectorSlider(instance.id, config, uiSpec, fxUIState);
            break;
        case 'button':
            widget = widgets.makeButton(instance.id, config, instance, uiSpec, fxUIState);
            break;
        default:
            throw new Error(`Unknown widget type: ${type}`);
    }
    if (type.toLowerCase() === 'select' || type.toLowerCase() === 'checkbox' || type.toLowerCase() === "referenceimage") {
        widget.addEventListener('input', () => {
            config[key] = widget.value;
            requestRender();
        });
    }
    if (drawTriggers.has(key)) {
        widget.addEventListener('input', () => {
            requestUIDraw()
        });
    }
    return [widget, foldout];
}

function buildGroup(instance, group, fxUIState, container, drawTriggers) {
    const groupState = fxUIState[group.label];
    const groupContents = document.createElement("div");
    groupContents.classList.add("effect-group");
    if (group.classes) {
        groupContents.classList.add(...group.classes);
    }
    groupContents.id = `${group.label}-${instance.id}`

    if (group.kind === 'collapse') {
        if (!Object.keys(groupState).includes('collapsed')) {
            if (group.collapsed === undefined) {
                groupState.collapsed = true;
            } else {
                groupState.collapsed = group.collapsed;
            }
        }
        const foldout = renderFoldoutToggle(groupState, group.label, requestUIDraw);
        groupContents.appendChild(foldout);
        // if (group?.color) {
        //     foldout.style.backgroundColor = group.color;
        // }
    } else {
        groupState.collapsed = false;
    }
    // Only build children if expanded
    if (!groupState.collapsed) {
        const inner = document.createElement('div');
        // TODO: style
        inner.className = 'group-contents';
        buildUI(instance, group.children, fxUIState, inner, drawTriggers, true);
        // if (group?.color) {
        //     inner.style.backgroundColor = group.color;
        // }
        groupContents.appendChild(inner);
    }
    container.appendChild(groupContents);
}


export function buildUI(instance, layout, fxUIState, container, drawTriggers, buildingGroup = false) {
    container.innerHTML = '';
    if (drawTriggers === undefined) {
        drawTriggers = new Set();
        collectVisibilityDrivers(layout, drawTriggers);
    }
    let trivialGroupAccum = []
    for (const item of layout) {
        if (!shouldRender(item, instance.config)) continue;
        if (!buildingGroup && item.type !== "group") {
            trivialGroupAccum.push(item);
        } else if (!buildingGroup && item.type === "group" && trivialGroupAccum.length > 0) {
            const trivialGroup = {classes: ["trivial=group"], children: trivialGroupAccum}
            buildGroup(instance, trivialGroup, fxUIState, container, drawTriggers);
            trivialGroupAccum = [];
            buildGroup(instance, item, fxUIState, container, drawTriggers);
        } else if (item.type === "group") {
            buildGroup(instance, item, fxUIState, container, drawTriggers);
        } else {
            const [widget, foldout] = buildWidget(instance, item, fxUIState, drawTriggers);
            container.appendChild(widget);
            if (foldout) {
                container.appendChild(foldout);
            }
        }
    }
    if (trivialGroupAccum.length > 0) {
        const trivialGroup = {classes: ["trivial-group"], children: trivialGroupAccum}
        buildGroup(instance, trivialGroup, fxUIState, container, drawTriggers);
    }
}

function createLabelEditor(fx, uiState) {
    const label = document.createElement("span");
    label.className = "effectLabel";
    label.textContent = fx.label || fx.name;
    label.contentEditable = false;
    label.spellcheck = false;
    label.addEventListener("click", (e) => {
        if (label.classList.contains("editing")) {
            e.stopPropagation();
        }
    });
    label.addEventListener("focus", (e) => {
        e.stopPropagation();
        label.classList.add("editing");
    });
    label.addEventListener("blur", () => {
        fx.label = label.textContent.trim();
        label.contentEditable = false;
        label.classList.remove("editing");
    });
    label.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            label.blur();
        } else if (e.key === "Escape") {
            e.preventDefault();
            label.textContent = fx.label;
            label.blur();
        }
    })

    const pencil = document.createElement("button");
    pencil.className = "editButton";
    pencil.innerHTML = "✎"; // or use an SVG/icon font
    pencil.title = "Rename effect";
    pencil.addEventListener("click", (e) => {
        e.stopPropagation();
        label.contentEditable = true;
        label.focus();
    });

    const presetDropdown = document.createElement('select');
    presetDropdown.appendChild(placeholderOption("Preset"));
    listEffectPresets(fx.name).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        presetDropdown.appendChild(opt);
    });

    presetDropdown.addEventListener('click', e => {
        e.stopPropagation()
    });


    presetDropdown.addEventListener('change', e => {
        e.stopPropagation()
        const selected = e.target.value;
        const preset = getEffectPresetView(fx.name, selected);
        if (preset) {
            Object.assign(fx.config, structuredClone(preset));
            requestRender();
        }
    });

    const savePresetBtn = document.createElement("button");
    savePresetBtn.innerHTML = "💾"
    savePresetBtn.className = "save-effect-preset-btn";
    savePresetBtn.addEventListener('click', e => {
        e.stopPropagation()
        saveEffectPreset(fx.name, label.textContent, structuredClone(fx.config));
        const newOpt = document.createElement('option');
        newOpt.value = label.textContent;
        newOpt.textContent = label.textContent;
        presetDropdown.appendChild(newOpt);
    });

    const labelWrapper = document.createElement("div");
    labelWrapper.className = "labelWrapper";
    labelWrapper.append(label, pencil, presetDropdown, savePresetBtn);
    return labelWrapper;
}

function createControlGroup(fx, effectStack, uiState, i) {
    const enableToggle = document.createElement('input');
    enableToggle.type = 'checkbox';
    enableToggle.classList.add("enableToggle");
    enableToggle.classList.add("effectToggle");
    enableToggle.name = 'enable/disable'
    enableToggle.checked = !fx.disabled;
    enableToggle.title = 'Enable/Disable Effect';
    enableToggle.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    enableToggle.addEventListener('change', () => {
        fx.disabled = !enableToggle.checked;
        requestRender();
    });

    const soloToggle = document.createElement("input");
    soloToggle.type = "checkbox";
    soloToggle.classList.add("soloToggle");
    soloToggle.classList.add("effectToggle");
    soloToggle.checked = fx.solo ?? false;
    soloToggle.title = "Solo this effect";
    soloToggle.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    soloToggle.addEventListener("change", () => {
        const isNowSoloed = soloToggle.checked;

        for (const fx of effectStack) {
            fx.solo = false;
        }
        if (isNowSoloed) {
            fx.solo = true;
            fx.disabled = false;
        } else {
            fx.solo = false;
        }
        requestRender();
    });

    const dupBtn = document.createElement("button");
    dupBtn.textContent = "⧉";
    dupBtn.title = "Duplicate effect";
    dupBtn.className = "effectButton";
    dupBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const newFx = makeEffectInstance(effectRegistry[fx.name]);
        await newFx.ready;
        newFx.config = structuredClone(fx.config);
        effectStack.splice(i + 1, 0, newFx);
        requestUIDraw();
        requestRender();
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = '×';
    delBtn.className = "effectButton";
    delBtn.disabled = fx.pinned;
    delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (fx.cleanupHook) {
            fx.cleanupHook(fx);
        }
        effectStack.splice(i, 1);
        clearRenderCache();
        requestUIDraw();
        requestRender();
    });

    const upBtn = document.createElement("button");
    upBtn.textContent = "↑";
    upBtn.title = "Move up";
    upBtn.disabled = i === 0;
    upBtn.className = "effectButton"
    upBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        moveEffectInStack(effectStack, i, i - 1);
        requestUIDraw();
        requestRender();
    });

    const downBtn = document.createElement("button");
    downBtn.textContent = "↓";
    downBtn.title = "Move down";
    downBtn.disabled = i === effectStack.length - 1 || fx.pinned;
    downBtn.className = "effectButton";
    downBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveEffectInStack(effectStack, i, i + 1);
        requestUIDraw();
        requestRender();
    });

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "⟲";
    resetBtn.title = "Reset effect";
    resetBtn.className = "effectButton";
    resetBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        fx.config = structuredClone(effectRegistry[fx.name].defaultConfig);
        requestUIDraw();
        requestRender();
    });

    const controlGroup = document.createElement("div");
    controlGroup.className = "controlGroup";
    if (!fx.pinned) {
        controlGroup.append(enableToggle, soloToggle, upBtn, downBtn, dupBtn, resetBtn, delBtn);
    } else {
        controlGroup.append(enableToggle, soloToggle, resetBtn);
    }
    return controlGroup;
}

function decorateForSolo(card, fx, effectStack) {
    const anySolo = effectStack.some(f => f.solo);
    if (anySolo) {
        card.classList.toggle("soloed", fx.solo);
        card.classList.toggle("unsoloed", !fx.solo);
    } else {
        card.classList.remove("soloed", "unsoloed");
    }
}

function renderEffectInStackUI(fx, i, effectStack, fxUIState, stackContainer) {
    // Main card container
    const card = document.createElement('div');
    card.className = 'effect-card';
    if (fx.id === getSelectedEffectId()) {
        card.classList.add('expanded');
    }
    // Header
    const header = document.createElement('div');
    header.className = 'effect-header';
    header.addEventListener('click', () => {
        toggleEffectSelection(fx);
        requestUIDraw();
    });
    const labelWrapper = createLabelEditor(fx);
    const controlGroup = createControlGroup(
        fx, effectStack, fxUIState, i,
    );
    header.append(labelWrapper, controlGroup);
    card.appendChild(header);

    if (isSelectedEffect(fx)) {
        const configContainer = document.createElement('div');
        configContainer.className = 'effect-config';
        buildUI(fx, fx.uiLayout, fxUIState, configContainer);
        card.appendChild(configContainer);
    }
    decorateForSolo(card, fx, effectStack);
    stackContainer.appendChild(card);
}

export function renderStackUI(effectStack, uiState, stackContainer) {
    stackContainer.innerHTML = '';
    for (let i = 0; i <= effectStack.length; i++) {
        if (i >= effectStack.length) return;
        const fx = effectStack[i];
        renderEffectInStackUI(fx, i, effectStack, uiState[fx.id], stackContainer);
    }
}
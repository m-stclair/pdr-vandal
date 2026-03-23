import {effectRegistry} from "../registry.js";
import {injectPartial} from "../utils/partials.js";

export class EffectPicker extends HTMLElement {
    constructor() {
        super();
        this.inSearchMode = false;
        this.tagsExpanded = false;
        this.activeTags = new Set();

        this.shadow = this.attachShadow({mode: "open"});

        this.ready = this.init(); // so user can await it externally if needed
    }

    async init() {
        // Inject HTML
        const partialURL = new URL("../partials/effectpicker.html", import.meta.url);
        await injectPartial(partialURL, this.shadow);
        // Inject CSS
        const styleElement = this.shadow.getElementById("style-element");
        const styleURL = new URL("../css/effectpicker.css", import.meta.url);
        const cssText = await fetch(styleURL).then(res => res.text());
        styleElement.textContent = cssText;

        // Now safe to access DOM elements
        this.searchInput = this.shadow.getElementById("search-input");
        // this.tagToggle = this.shadow.getElementById("tag-toggle");
        // this.tagFilters = this.shadow.getElementById("tag-filters");
        this.effectList = this.shadow.getElementById("effect-list");
        this.groupIsOpen = {}
        this.initEffectBrowser();
        this.renderGroupedEffectList(effectRegistry, this.activeTags, "", true);
    }


    setEffectSelectCallback(callback) {
        this.effectSelectCallback = callback;
    }

    connectedCallback() {
        // currently unused
        this.ready.then(() => {
        });
    }

    initEffectBrowser() {
        const allTags = new Set();
        Object.values(effectRegistry).forEach(entry =>
            entry.meta.tags.forEach(tag => allTags.add(tag))
        );

        const renderTags = () => {
            this.tagFilters.innerHTML = "";
            allTags.forEach(tag => {
                const div = document.createElement("div");
                div.textContent = tag;
                div.className = "tag";
                if (this.activeTags.has(tag)) div.classList.add("active");
                div.onclick = () => {
                    if (this.activeTags.has(tag)) this.activeTags.delete(tag);
                    else this.activeTags.add(tag);
                    renderEffectList();
                    renderTags();
                };
                this.tagFilters.appendChild(div);
            });
        };

        const renderEffectList = () => {
            const search = this.searchInput.value.toLowerCase();
            this.effectList.innerHTML = "";
            Object.values(effectRegistry).forEach(entry => {
                const {name, meta} = entry;
                const matchesSearch =
                    name.toLowerCase().includes(search) ||
                    meta.description.toLowerCase().includes(search);
                const matchesTags = [...this.activeTags].every(tag =>
                    meta.tags.includes(tag)
                );
                if (matchesSearch && matchesTags) {
                    const tile = document.createElement("div");
                    tile.className = "effect-tile";
                    tile.innerHTML = `<div class="effect-name">${name}</div><div class="effect-desc">${meta.description}</div>`;
                    tile.addEventListener("click", () => {
                        if (this.effectSelectCallback) {
                            this.searchInput.value = "";
                            this.renderGroupedEffectList(effectRegistry, [], "")
                            this.effectSelectCallback(name);
                        } else {
                            console.error(`Failed to select effect: ${name}`);
                        }
                    });
                    this.effectList.appendChild(tile);
                }
            });
        };

        this.searchInput.addEventListener("input", () => {
            const isEmpty = this.searchInput.value.trim() === "";
            this.inSearchMode = !isEmpty;
            // this.tagToggle.style.display = isEmpty ? "block" : "none";
            // this.tagFilters.classList.toggle("expanded", isEmpty && this.tagsExpanded);
            this.renderGroupedEffectList(effectRegistry, this.activeTags, this.searchInput.value);
        });

        this.searchInput.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                this.searchInput.value = "";
                this.inSearchMode = false;
                // this.tagToggle.style.display = "block";
                // this.tagFilters.classList.toggle("expanded", this.tagsExpanded);
                this.renderGroupedEffectList(effectRegistry, this.activeTags, "");
            }
        });

        // this.tagToggle.onclick = () => {
        //     this.tagsExpanded = !this.tagsExpanded;
        //     this.tagFilters.classList.toggle("expanded", this.tagsExpanded);
        // };

        // renderTags();
    }

    renderGroupedEffectList(registry, activeTags, search, initializing = false) {
        this.effectList.innerHTML = "";
        const grouped = {};

        for (const entry of Object.values(registry)) {
            const {name, meta} = entry;
            if (!name || !meta || meta.notPickable) continue;
            const matchesSearch =
                name.toLowerCase().includes(search.toLowerCase()) ||
                meta.description.toLowerCase().includes(search.toLowerCase());
            const matchesTags = [...activeTags].every(tag => meta.tags.includes(tag));
            if (!matchesSearch || !matchesTags) continue;

            const group = meta.group || "Other";
            grouped[group] = grouped[group] || [];
            grouped[group].push(entry);
        }

        for (const groupName of Object.keys(grouped).sort()) {
            const groupEntries = grouped[groupName].sort((a, b) =>
                a.name.localeCompare(b.name)
            );
            const details = document.createElement("details");
            details.className = "effect-group";
            details.addEventListener("toggle", function () {
                if (this.inSearchMode) return;
                this.groupIsOpen[groupName] = details.open;
            }.bind(this));
            if (initializing) {
                details.open = false;
                this.groupIsOpen[groupName] = false;
            } else if (this.inSearchMode) {
                details.open = true;
            } else {
                details.open = this.groupIsOpen[groupName];
            }
            const summary = document.createElement("summary");
            summary.className = "group-label";
            summary.textContent = groupName;
            details.appendChild(summary);

            for (const entry of groupEntries) {
                const tile = document.createElement("div");
                tile.className = "effect-tile";
                tile.innerHTML = `<div class="effect-name">${entry.name}</div>${
                    this.inSearchMode ? `<div class="effect-desc">${entry.meta.description}</div>` : ""
                }`;
                tile.addEventListener("click", () => {
                    if (this.effectSelectCallback) {
                        this.inSearchMode = false;
                        this.searchInput.value = "";
                        this.renderGroupedEffectList(effectRegistry, [], "")
                        this.effectSelectCallback(entry.name);
                    } else {
                        console.error(`no callback attached`);
                    }
                });

                details.appendChild(tile);
            }

            this.effectList.appendChild(details);
        }
    }
}

customElements.define("effect-picker", EffectPicker);

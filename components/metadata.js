// Viewer for a product's labels and headers (PDS4, PDS3, VICAR, FITS, TIFF
// tags, ...; see pdrview.label_sections), one section each: parsed fields as
// a collapsible tree, or the raw text, with a text search over either.
// Rendering is lazy and skipped while the panel is collapsed.
const SEARCH_DEBOUNCE_MS = 120;

const escapeHTML = s => s.replace(/[&<>]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;"}[c]));

// `text` as a fragment with each (lower-cased) `query` hit wrapped in <mark>.
function markFragment(text, query) {
    const frag = document.createDocumentFragment();
    const lower = text.toLowerCase();
    let at = 0;
    for (let i = lower.indexOf(query); i !== -1; i = lower.indexOf(query, at)) {
        frag.append(text.slice(at, i));
        const mark = document.createElement("mark");
        mark.textContent = text.slice(i, i + query.length);
        frag.append(mark);
        at = i + query.length;
    }
    frag.append(text.slice(at));
    return frag;
}

function markText(el, text, query) {
    el.textContent = "";
    if (!query) {
        el.textContent = text;
        return;
    }
    el.append(markFragment(text, query));
}

// Highlight hits in the decoded text nodes under `root`, so entities and
// tags in already-parsed markup are never split.
function markTextNodes(root, query) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    for (const node of nodes) {
        if (node.data.toLowerCase().includes(query)) node.replaceWith(markFragment(node.data, query));
    }
}

function sectionTitle(section) {
    const kind = section.kind || "labels";
    return section.title ? `${kind} — ${section.title}` : kind;
}

// What the pane says in place of a section it couldn't read.
function errorText(section) {
    const what = section.title ? `${section.kind} (${section.title})`
        : section.kind ? `the ${section.kind} label` : "this product's labels";
    const fallback = section.raw ? ' Its text is under "raw".' : "";
    return `Couldn't read ${what}: ${section.error}.${fallback}`;
}

export class MetadataPanel {
    constructor() {
        this.panel = document.getElementById("metadataPanel");
        this.body = document.getElementById("metaBody");
        this.status = document.getElementById("metaStatus");
        this.input = document.getElementById("metaSearch");
        this.label = null;          // {sections: [{kind, title, tree, raw, error}]}
        this.mode = "tree";         // "tree" | "raw"
        this.query = "";
        this.timer = null;
        this.dirty = true;
        this.marks = [];            // every highlighted occurrence, in DOM order
        this.current = -1;          // index into marks
        this.prev = document.getElementById("metaPrev");
        this.next = document.getElementById("metaNext");

        const modes = document.getElementById("metaMode");
        modes.addEventListener("click", e => {
            const button = e.target.closest("button");
            if (!button) return;
            e.preventDefault();
            e.stopPropagation();
            modes.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === button));
            this.mode = button.dataset.mode;
            this.dirty = true;
            this.render();
        });
        // The search box lives in <summary>: keep clicks and keys (space!)
        // from folding the panel.
        this.input.addEventListener("click", e => e.stopPropagation());
        this.input.addEventListener("keydown", e => {
            e.stopPropagation();
            if (e.key === "Escape") {
                this.input.value = "";
                this.setQuery("");
            } else if (e.key === "Enter") {
                e.preventDefault();
                // Enter right after typing: apply the pending query first.
                if (this.timer !== null) this.setQuery(this.input.value);
                this.step(e.shiftKey ? -1 : 1);
            }
        });
        for (const [button, direction] of [[this.prev, -1], [this.next, 1]]) {
            button.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                this.step(direction);
            });
        }
        this.input.addEventListener("input", () => {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.setQuery(this.input.value), SEARCH_DEBOUNCE_MS);
        });
        this.panel.addEventListener("toggle", () => this.panel.open && this.render());
    }

    /**
     * Show a product's labels: {sections: [{kind, title, tree, raw, error}]},
     * or a single {kind, tree, raw}. Hides the panel for null or no sections.
     */
    setLabel(label) {
        const all = !label ? [] : label.sections ?? [{title: "", ...label}];
        // {note} entries are asides (e.g. files left uninspected), not sections
        const sections = all.filter(s => !s.note)
            .map(s => ({...s, kind: String(s.kind ?? "").toUpperCase()}));
        const notes = all.filter(s => s.note).map(s => String(s.note));
        this.label = sections.length ? {sections, notes} : null;
        this.panel.hidden = !this.label;
        const kinds = [...new Set(sections.map(s => s.kind).filter(Boolean))];
        document.getElementById("metaKind").textContent = kinds.join(" + ");
        this.dirty = true;
        this.render();
    }

    /** Show one section that only says why the label couldn't be read. */
    setError(message) {
        this.setLabel({sections: [{kind: "", title: "", tree: null, raw: null, error: message}]});
    }

    clear() {
        this.setLabel(null);
    }

    setQuery(q) {
        clearTimeout(this.timer);
        this.timer = null;
        this.query = q.trim().toLowerCase();
        this.dirty = true;
        this.render();
    }

    render() {
        if (!this.panel.open || !this.dirty) return;
        this.dirty = false;
        this.body.textContent = "";
        this.status.textContent = "";
        this.marks = [];
        this.current = -1;
        if (this.label) {
            if (this.mode === "tree") this.renderTree();
            else this.renderRaw();
            this.collect();
        }
        this.updateStatus();
    }

    // Gather the highlighted occurrences and go to the first one.
    collect() {
        this.marks = [...this.body.querySelectorAll("mark")];
        if (this.marks.length) this.step(0, 0);
    }

    /** Move to the next (+1) / previous (-1) occurrence, wrapping around. */
    step(direction, at = null) {
        const n = this.marks.length;
        if (!n) return;
        this.marks[this.current]?.classList.remove("current");
        this.current = at ?? (this.current + direction + n) % n;
        const mark = this.marks[this.current];
        mark.classList.add("current");
        // The user may have folded sections since the search ran.
        for (let d = mark.closest("details"); d; d = d.parentElement.closest("details")) d.open = true;
        mark.scrollIntoView({block: "center"});
        this.updateStatus();
    }

    updateStatus() {
        const n = this.marks.length;
        this.prev.disabled = this.next.disabled = n === 0;
        if (!this.query) this.status.textContent = "";
        else this.status.textContent = n ? `${this.current + 1} / ${n}` : "no matches";
    }

    renderTree() {
        const sections = this.label.sections;
        // A single readable section looks as it always has: its top-level
        // groups straight in the body.
        if (sections.length === 1 && sections[0].tree && !sections[0].error) {
            this.buildTree(sections[0].tree, this.body);
        } else {
            this.renderSections(sections);
        }
        for (const note of this.label.notes) {
            const div = document.createElement("div");
            div.className = "meta-note";
            markText(div, note, this.query);
            this.body.append(div);
        }
    }

    renderSections(sections) {
        for (const section of sections) {
            const holder = document.createElement("details");
            holder.className = "meta-section";
            const summary = document.createElement("summary");
            markText(summary, sectionTitle(section), this.query);
            const inner = document.createElement("div");
            holder.append(summary, inner);
            let found = this.has(sectionTitle(section));
            if (section.error) {
                const err = document.createElement("div");
                err.className = "meta-error";
                const text = errorText(section);
                markText(err, text, this.query);
                inner.append(err);
                found = this.has(text) || found;
            }
            if (section.tree) found = this.buildTree(section.tree, inner) || found;
            holder.open = sections.length === 1 || found;
            this.body.append(holder);
        }
    }

    has(text) {
        return this.query !== "" && text.toLowerCase().includes(this.query);
    }

    // Append `tree` (its root's children, the root itself dropped) to
    // `parent`; returns whether anything in it matches the query.
    buildTree(tree, parent) {
        const q = this.query;
        // Builds the whole tree; search only decides which sections start open.
        // Returns whether this node or anything below it matches.
        const build = (node, parent, depth = 0) => {
            const has = text => q !== "" && text.toLowerCase().includes(q);
            if (node.children) {
                const holder = document.createElement("details");
                const summary = document.createElement("summary");
                markText(summary, node.key, q);
                const inner = document.createElement("div");
                holder.append(summary, inner);
                let found = has(node.key);
                const counts = {};
                const seen = {};
                node.children.forEach(c => { counts[c.key] = (counts[c.key] ?? 0) + 1; });
                for (const child of node.children) {
                    const label = counts[child.key] > 1
                        ? {...child, key: `${child.key} [${seen[child.key] = (seen[child.key] ?? 0) + 1}]`}
                        : child;
                    found = build(label, inner, depth + 1) || found;
                }
                // Open top-level sections, and any section that is or holds a match.
                holder.open = depth <= 1 || found;
                parent.append(holder);
                return found;
            }
            const value = node.value ?? "";
            const unit = node.unit ?? "";
            const comment = node.comment ?? "";
            const row = document.createElement("div");
            row.className = "meta-row";
            row.title = "click to copy value";
            const k = document.createElement("span"), v = document.createElement("span");
            k.className = "meta-key";
            v.className = "meta-val";
            markText(k, node.key, q);
            markText(v, value, q);
            if (unit) {
                const u = document.createElement("span");
                u.className = "meta-unit";
                markText(u, ` ${unit}`, q);
                v.append(u);
            }
            row.append(k, v);
            if (comment) {
                const c = document.createElement("span");
                c.className = "meta-comment";
                c.title = comment;   // shown in full on hover; clipped in the row
                markText(c, comment, q);
                row.append(c);
            }
            row.addEventListener("click", () => this.copy(value, row));
            parent.append(row);
            return has(node.key) || has(value) || has(unit) || has(comment);
        };
        // Build into a scratch holder, then drop the root wrapper so its
        // top-level groups sit directly in `parent`.
        const scratch = document.createElement("div");
        const found = build(tree, scratch);
        const root = scratch.firstElementChild;
        if (root?.tagName === "DETAILS") parent.append(...root.lastElementChild.childNodes);
        else parent.append(...scratch.childNodes);
        return found;
    }

    renderRaw() {
        const q = this.query;
        const sections = this.label.sections;
        const single = sections.length === 1 && !sections[0].error;
        const parts = sections.map(s => ({
            section: s,
            divider: single ? "" : `=== ${sectionTitle(s)} ===\n`,
            text: s.raw ?? (s.error ? `(${errorText(s)})\n` : "(no raw text for this section)\n"),
        }));
        const notes = this.label.notes.map(n => `(${n})\n`);
        const plain = [...parts.map(p => p.divider + p.text), ...notes].join("\n");
        const copy = document.createElement("button");
        copy.id = "metaCopy";
        copy.textContent = "copy raw";
        copy.addEventListener("click", () => this.copy(plain, copy));
        const pre = document.createElement("pre");
        // Escape first, then color XML tags (PDS4 sections only); search hits
        // are marked afterwards on the parsed text nodes.
        const html = parts.map(p => {
            let body = escapeHTML(p.text);
            if (p.section.kind === "PDS4" && p.section.raw) {
                body = body.replace(/(&lt;[^]*?&gt;)/g, '<span class="xml-tag">$1</span>');
            }
            const divider = p.divider
                ? `<span class="meta-divider">${escapeHTML(p.divider)}</span>` : "";
            return divider + body;
        }).concat(notes.map(escapeHTML)).join("\n");
        pre.innerHTML = html;
        if (q) markTextNodes(pre, q);
        this.body.append(copy, pre);
    }

    async copy(text, el) {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            return;
        }
        el.classList.add("copied");
        setTimeout(() => el.classList.remove("copied"), 600);
    }
}

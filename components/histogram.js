// Histogram of the image as displayed, for the whole image (at fit-to-window
// resolution) or the current view. Updates after rendering settles, at a
// limited rate while animating, and never while the panel is collapsed.
import {computeHistogram, HISTOGRAM_BINS} from "../utils/histogram.js";
import {hashObject} from "../utils/helpers.js";

const SETTLE_MS = 150;            // debounce after the last render
const ANIMATING_VIEW_MS = 250;    // view histogram while animating: <= 4 Hz
const ANIMATING_WHOLE_MS = 100;  // whole-image histogram while animating: <= 10 Hz
// Balanced so that equal R, G and B curves add up to neutral gray-white
// (each component sums to 340 across the three colors).
const CHANNEL_COLORS = ["rgba(240, 50, 50, 0.6)", "rgba(50, 220, 50, 0.6)", "rgba(50, 70, 240, 0.6)"];
const GRAY_COLOR = "rgba(204, 204, 204, 0.85)";

const percent = f => `${(100 * f).toFixed(f < 0.001 ? 2 : 1)}%`;

export class HistogramPanel {
    /**
     * @param {import('../utils/glitch_renderer.js').GlitchRenderer} renderer
     * @param {() => object[]} getStack the effect stack
     */
    constructor(renderer, getStack) {
        this.renderer = renderer;
        this.getStack = getStack;
        this.panel = document.getElementById("histogramPanel");
        this.canvas = document.getElementById("histogramCanvas");
        this.info = document.getElementById("histogramInfo");
        this.region = "view";       // "view" | "image"
        this.logScale = true;
        this.hist = null;
        this.hoverBin = null;
        this.timer = null;
        this.wholeCache = {key: null, source: null, hist: null};

        this.bindToggle("histRegion", "region", value => { this.region = value; });
        this.bindToggle("histScale", "scale", value => { this.logScale = value === "log"; });
        this.panel.addEventListener("toggle", () => this.panel.open && this.scheduleUpdate());
        this.canvas.addEventListener("mousemove", e => this.onHover(e));
        this.canvas.addEventListener("mouseleave", () => { this.hoverBin = null; this.drawInfo(); });
        new ResizeObserver(() => this.draw()).observe(this.canvas);
    }

    // Segmented toggle: buttons with data-<attr>; clicking one selects it
    // without folding the panel (the toggles live in its <summary>).
    bindToggle(id, attr, apply) {
        const group = document.getElementById(id);
        group.addEventListener("click", e => {
            const button = e.target.closest("button");
            if (!button) return;
            e.preventDefault();
            e.stopPropagation();
            group.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === button));
            apply(button.dataset[attr]);
            if (attr === "region") this.scheduleUpdate(this.lastT, this.animating, 0);
            else this.draw();
        });
    }

    /** Called after every rendered frame. */
    scheduleUpdate(t = this.lastT ?? null, animating = false, delay = null) {
        this.lastT = t;
        this.animating = animating;
        if (!this.panel.open) return;
        if (animating && this.timer !== null) return;   // throttle: keep the pending update
        clearTimeout(this.timer);
        const wait = delay ?? (!animating ? SETTLE_MS
            : this.region === "image" && !this.atFit() ? ANIMATING_WHOLE_MS : ANIMATING_VIEW_MS);
        this.timer = setTimeout(() => {
            this.timer = null;
            this.update();
        }, wait);
    }

    // At fit-to-window the view is the whole image.
    atFit() {
        const v = this.renderer.visibleRegion();
        return v.u0 <= 0 && v.v0 <= 0 && v.u1 >= 1 && v.v1 >= 1;
    }

    update() {
        const R = this.renderer;
        if (!this.panel.open || !R.source) return;
        if (this.region === "image" && !this.atFit()) {
            this.hist = this.wholeImageHistogram();
        } else {
            const tex = R.applyEffects(this.lastT);   // cached: no re-render
            if (!tex) return;
            const sample = R.sampleView(tex);
            this.hist = computeHistogram(sample.pixels, sample.w * sample.h);
        }
        this.draw();
    }

    wholeImageHistogram() {
        const R = this.renderer;
        const key = JSON.stringify([
            this.getStack().map(fx => [fx.id, fx.disabled, fx.solo, hashObject(fx.config)]),
            R.getDebayerConfig(), R.gl.canvas.width, R.gl.canvas.height,
            this.animating ? this.lastT : null,
        ]);
        const cache = this.wholeCache;
        if (cache.key !== key || cache.source !== R.source) {
            const sample = R.sampleWholeImage(this.lastT);
            if (!sample) return this.hist;
            Object.assign(cache, {key, source: R.source, hist: computeHistogram(sample.pixels, sample.w * sample.h)});
        }
        return cache.hist;
    }

    draw() {
        const canvas = this.canvas;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        if (this.hist && this.hist.total > 0) {
            const scale = this.logScale ? Math.log1p : x => x;
            let peak = 0;
            for (const counts of this.hist.counts) {
                for (const c of counts) peak = Math.max(peak, scale(c));
            }
            const colors = this.hist.gray ? [GRAY_COLOR] : CHANNEL_COLORS;
            ctx.globalCompositeOperation = "lighter";
            this.hist.counts.forEach((counts, ch) => {
                ctx.fillStyle = colors[ch];
                ctx.beginPath();
                ctx.moveTo(0, h);
                for (let i = 0; i < HISTOGRAM_BINS; i++) {
                    const y = h - (peak > 0 ? scale(counts[i]) / peak : 0) * (h - 1);
                    ctx.lineTo((i / HISTOGRAM_BINS) * w, y);
                    ctx.lineTo(((i + 1) / HISTOGRAM_BINS) * w, y);
                }
                ctx.lineTo(w, h);
                ctx.closePath();
                ctx.fill();
            });
            ctx.globalCompositeOperation = "source-over";
            if (this.hoverBin !== null) {
                ctx.fillStyle = "rgba(0, 170, 255, 0.35)";
                ctx.fillRect((this.hoverBin / HISTOGRAM_BINS) * w, 0, Math.max(1, w / HISTOGRAM_BINS), h);
            }
        }
        this.drawInfo();
    }

    drawInfo() {
        const hist = this.hist;
        if (!hist || hist.total === 0) {
            this.info.textContent = hist ? "no displayable pixels" : "";
            return;
        }
        if (this.hoverBin !== null) {
            const lo = Math.max(0, (this.hoverBin - 0.5) / 255), hi = Math.min(1, (this.hoverBin + 0.5) / 255);
            // Percentages only: counts are of a pixel sample, not the image.
            const names = hist.gray ? [""] : ["R ", "G ", "B "];
            const parts = hist.counts.map((counts, ch) =>
                `${names[ch]}${percent(counts[this.hoverBin] / hist.total)}`);
            this.info.textContent = `${lo.toFixed(3)}–${hi.toFixed(3)}  ${parts.join("  ")}`;
            return;
        }
        const parts = [];
        if (hist.below > 0) parts.push(`< 0: ${percent(hist.below)}`);
        if (hist.above > 0) parts.push(`> 1: ${percent(hist.above)}`);
        if (hist.nan > 0) parts.push(`NaN: ${percent(hist.nan)}`);
        if (this.animating && this.region === "image" && !this.atFit()) parts.push("1 Hz while animating");
        this.info.textContent = parts.join("  ");
    }

    onHover(e) {
        const rect = this.canvas.getBoundingClientRect();
        const bin = Math.floor(((e.clientX - rect.left) / rect.width) * HISTOGRAM_BINS);
        this.hoverBin = Math.min(HISTOGRAM_BINS - 1, Math.max(0, bin));
        this.draw();
    }
}

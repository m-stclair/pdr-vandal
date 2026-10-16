"""
Fixtures: a local static server for the repo, headless Chromium, and an
`app` handle that drives the real app page. Playwright is imported only
inside the browser fixtures, so `pytest -m "not browser"` runs without it.
"""
import base64
import functools
import re
import http.server
import threading
from pathlib import Path

import numpy as np
import pytest

REPO = Path(__file__).resolve().parent.parent


def pytest_collection_modifyitems(items):
    # Anything that uses the app or the browser needs Playwright.
    for item in items:
        if {"app", "browser"} & set(getattr(item, "fixturenames", ())):
            item.add_marker(pytest.mark.browser)


class _Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


@pytest.fixture(scope="session")
def server():
    httpd = http.server.ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(_Handler, directory=str(REPO))
    )
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


@pytest.fixture(scope="session")
def browser():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as playwright:
        chromium = playwright.chromium.launch()
        yield chromium
        chromium.close()


# Typed-array <-> base64, for lossless transfer of pixel data.
_INIT_SCRIPT = """
window.__b64enc = (typed) => {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
};
window.__b64dec = (str, Ctor) => {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Ctor(bytes.buffer);
};
"""

# Prelude for App.js(): the app's own module instances.
_PRELUDE = """
const S = await import('/state.js');
const R = S.appRenderer;
const registry = (await import('/registry.js')).effectRegistry;
const frames = async (n = 4) => {
    for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r));
};
"""


def _b64(array):
    return base64.b64encode(np.ascontiguousarray(array).tobytes()).decode()


class App:
    """The real app page, with helpers for loading data and reading results."""

    def __init__(self, page):
        self.page = page

    def js(self, body, arg=None):
        """Run an async JS body in the page (S = state.js, R = renderer,
        registry, frames) and return its JSON-serializable result."""
        return self.page.evaluate(
            "async (arg) => {" + _PRELUDE + body + "}", arg
        )

    def frames(self, n=4):
        self.js("await frames(arg);", n)

    def load_float(self, values, scale=1.0, offset=0.0):
        """Load normalized float32 data (H, W) or (H, W, 3) the way the PDR
        path does, with statistics in the same normalized units."""
        values = np.asarray(values, dtype=np.float32)
        h, w = values.shape[:2]
        channels = 1 if values.ndim == 2 else values.shape[2]
        finite = values[np.isfinite(values)]
        p02, p98 = np.percentile(finite, [2, 98])
        self.js("""
            S.loadFloatSource({
                pixels: __b64dec(arg.data, Float32Array), width: arg.w,
                height: arg.h, channels: arg.c, scale: arg.scale,
                offset: arg.offset, mean: arg.mean, std: arg.std,
                p02: arg.p02, p98: arg.p98,
            });
            S.clearRenderCache();
            S.resizeAndRedraw();
            await frames();
        """, {"data": _b64(values), "w": w, "h": h, "c": channels,
              "scale": scale, "offset": offset, "mean": float(finite.mean()),
              "std": float(finite.std()), "p02": float(p02), "p98": float(p98)})

    def load_rgba8(self, rgba):
        """Load an 8-bit RGBA image as a browser image. Returns the bytes the
        renderer actually holds (H, W, 4), which tests should use as truth."""
        h, w = rgba.shape[:2]
        data = self.js("""
            const cv = new OffscreenCanvas(arg.w, arg.h);
            const bytes = __b64dec(arg.data, Uint8ClampedArray);
            cv.getContext('2d').putImageData(new ImageData(bytes, arg.w, arg.h), 0, 0);
            const blob = await cv.convertToBlob({type: 'image/png'});
            const img = new Image();
            await new Promise((ok, fail) => {
                img.onload = ok; img.onerror = fail;
                img.src = URL.createObjectURL(blob);
            });
            R.setHTMLSource(img);
            S.resizeAndRedraw();
            await frames();
            return __b64enc(new Uint8Array(R.source.data));
        """, {"data": _b64(rgba.astype(np.uint8)), "w": w, "h": h})
        return np.frombuffer(base64.b64decode(data), dtype=np.uint8).reshape(h, w, 4)

    def add_effect(self, name, **config):
        """Add an effect (after awaiting its readiness); returns its id."""
        return self.js("""
            const fx = S.makeEffectInstance(registry[arg.name]);
            await fx.ready;
            Object.assign(fx.config, arg.config);
            S.addEffectToStack(fx);
            S.requestRender();
            await frames();
            return fx.id;
        """, {"name": name, "config": config})

    def configure(self, fx_id, **config):
        self.js("""
            Object.assign(S.getEffectById(arg.id).config, arg.config);
            S.requestRender();
            await frames();
        """, {"id": fx_id, "config": config})

    def input_stretch(self, **config):
        self.js("""
            Object.assign(S.inputStretchEffect.config, arg);
            S.requestRender();
            await frames();
        """, config)

    def export(self, full_image=True):
        """Export as the app does, before 8-bit conversion: float32
        (H, W, 4), row 0 = image top."""
        out = self.js("""
            const e = await R.createExport(0, arg);
            return {data: __b64enc(e.pixels), w: e.w, h: e.h};
        """, full_image)
        pixels = np.frombuffer(base64.b64decode(out["data"]), dtype=np.float32)
        return pixels.reshape(out["h"], out["w"], 4)

    def set_view(self, zoom=1.0, center=(0.5, 0.5)):
        self.js("""
            R.zoom = arg.zoom;
            [R.centerX, R.centerY] = arg.center;
            R.clampCenter();
            R.inputDirty = true;
            S.requestRender();
            await frames();
        """, {"zoom": zoom, "center": list(center)})

    def client_point(self, fx, fy):
        """Integer client coordinates (as mouse events carry) of a point at
        fractions (fx, fy) of the displayed image."""
        return self.js("""
            const cv = R.gl.canvas, rect = cv.getBoundingClientRect();
            const vr = R.getViewRect();
            const px = vr.x + arg[0] * vr.w, py = vr.y + arg[1] * vr.h;
            return [Math.round(rect.left + px * rect.width / cv.width),
                    Math.round(rect.top + py * rect.height / cv.height)];
        """, [fx, fy])

    def readout(self, client_x, client_y):
        """The coordinate/value readout shown for a mouse position."""
        return self.js("""
            R.gl.canvas.dispatchEvent(new MouseEvent('mousemove',
                {clientX: arg[0], clientY: arg[1], bubbles: true}));
            return document.getElementById('coordOutput').innerText;
        """, [client_x, client_y])


def open_app(browser, server, before_load=None):
    """Open the app in a fresh context and wait until startup completes.
    `before_load(context)` can install request routes first. Returns
    (App, context, errors)."""
    context = browser.new_context(
        service_workers="block", viewport={"width": 1280, "height": 860}
    )
    # Hermetic: no network beyond the local server. pdr.js imports the
    # Pyodide loader from a CDN at startup; no test opens PDS products, so it
    # gets a stub. (Later routes take precedence, so the stub goes last.)
    context.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda route: route.abort())
    context.route("https://cdn.jsdelivr.net/pyodide/**", lambda route: route.fulfill(
        status=200, content_type="text/javascript",
        body="export async function loadPyodide() { throw new Error('Pyodide is stubbed in tests'); }",
    ))
    if before_load:
        before_load(context)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text}"))
    page.add_init_script(_INIT_SCRIPT)
    page.goto(server + "/")
    page.wait_for_selector("body[data-ready='1']", state="attached", timeout=30000)
    return App(page), context, errors


@pytest.fixture
def app(browser, server):
    handle, context, errors = open_app(browser, server)
    yield handle
    context.close()
    assert not errors, "browser errors during test:\n" + "\n".join(errors)


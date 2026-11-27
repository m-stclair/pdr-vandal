"""
P1: regressions for bugs fixed in the past, and view geometry.
"""
import re

import numpy as np
import pytest

from conftest import open_app
from reference.fixtures import random_mosaic


# --- Debayer shader-load race ------------------------------------------------

@pytest.fixture
def held_shader_app(browser, server):
    """App whose debayer.frag request is held until the test releases it."""
    held = []
    handle, context, errors = open_app(
        browser, server,
        before_load=lambda ctx: ctx.route("**/build/shaders/debayer.*.frag", lambda route: held.append(route)),
    )
    handle.load_float(random_mosaic(64, 96))
    yield handle, held
    context.close()
    assert not errors, "browser errors during test:\n" + "\n".join(errors)


def _wait_for(app, condition_js, timeout_ms=10000):
    """Poll a page condition without rendering anything ourselves."""
    return app.js(f"""
        const t0 = performance.now();
        while (performance.now() - t0 < {timeout_ms}) {{
            if ({condition_js}) return true;
            await new Promise(r => setTimeout(r, 20));
        }}
        return false;
    """)


def test_debayer_waits_for_its_shader(held_shader_app):
    """Added the normal way (awaiting fx.ready), Debayer only enters the
    stack once its shader exists, so the raw mosaic is never shown."""
    app, held = held_shader_app
    app.js("""
        window.__fx = S.makeEffectInstance(registry['Debayer']);
        window.__fx.config.RGB = true;
        window.__ready = false;
        window.__fx.ready.then(() => { window.__ready = true; });
        await frames(10);
    """)
    assert len(held) == 1, "debayer.frag should be requested exactly once"
    assert app.js("return window.__ready;") is False, "fx.ready resolved before the shader loaded"
    held[0].continue_()
    assert _wait_for(app, "window.__ready"), "fx.ready never resolved"
    app.js("S.addEffectToStack(window.__fx); S.requestRender(); await frames(6);")
    assert '"RGB":1' in (app.js("return R.lastDebayerKey;") or "")


def test_render_recovers_when_shader_arrives(held_shader_app):
    """Added without awaiting fx.ready (the randomizer's path), the first
    frame shows the mosaic; when the shader arrives the app must re-render by
    itself, with no further action."""
    app, held = held_shader_app
    app.js("""
        const fx = S.makeEffectInstance(registry['Debayer']);
        fx.config.RGB = true;
        S.addEffectToStack(fx);
        S.requestRender();
        await frames(10);
    """)
    assert app.js("return R.lastDebayerKey;") is None, "race not reproduced"
    held[0].continue_()
    assert _wait_for(app, "(R.lastDebayerKey || '').includes('\"RGB\":1')"), \
        "the app did not re-render with the Debayer program after the shader loaded"


# --- Debayer AUTO gains, per instance ----------------------------------------

def _gains(app, fx_id):
    return app.js("const c = S.getEffectById(arg).config; return [c.GAIN_R, c.GAIN_G, c.GAIN_B, c.AUTO];", fx_id)


def _auto_pair(app):
    """Two AUTO Debayers with different regions (whole image vs a zoomed
    view), so their gains differ. Returns (first, second, second_alone),
    where second_alone are the gains the second computes when it is the only
    Debayer: the independent expectation."""
    h, w = 120, 160
    y, x = np.mgrid[0:h, 0:w]
    rgb = np.dstack([0.2 + 0.7 * x / w, 0.3 + 0.5 * y / h, 0.8 - 0.6 * x / w])
    cls = np.array([[0, 1], [1, 2]])[y % 2, x % 2]
    app.load_float(np.take_along_axis(rgb, cls[..., None], 2)[..., 0].astype(np.float32))
    app.set_view(4.0, (0.2, 0.25))
    second = app.add_effect("Debayer", RGB=True, AUTO=True, AUTO_REGION=1)
    second_alone = _gains(app, second)
    app.js("S.filterEffectStack(f => f.id !== arg);", second)
    first = app.add_effect("Debayer", RGB=True, AUTO=True, AUTO_REGION=0)
    second = app.add_effect("Debayer", RGB=True, AUTO=True, AUTO_REGION=1)
    assert _gains(app, first)[3] is True
    return first, second, second_alone


@pytest.mark.parametrize("action", ["disable", "delete", "reorder"])
def test_auto_gains_follow_the_active_instance(app, action):
    first, second, second_alone = _auto_pair(app)
    if action == "disable":
        app.js("S.getEffectById(arg).disabled = true;", first)
    elif action == "delete":
        app.js("S.filterEffectStack(f => f.id !== arg);", first)
    else:
        app.js("""
            const st = S.getEffectStack();
            const i = st.findIndex(f => f.id === arg[0]), j = st.findIndex(f => f.id === arg[1]);
            [st[i], st[j]] = [st[j], st[i]];
        """, [first, second])
    app.js("S.requestRender(); await frames(6);")
    *gains, auto = _gains(app, second)
    assert auto is True, f"AUTO was switched off on the newly active Debayer after {action}"
    assert gains == second_alone[:3], "newly active Debayer did not compute its own gains"


def test_gain_edit_while_inactive_is_respected(app):
    first, second, _ = _auto_pair(app)
    app.js("S.getEffectById(arg).disabled = true; S.requestRender(); await frames(4);", first)
    app.js("S.getEffectById(arg).config.GAIN_R = 3.21;", first)
    app.js("S.getEffectById(arg).disabled = false; S.requestRender(); await frames(4);", first)
    *gains, auto = _gains(app, first)
    assert auto is False and gains[0] == 3.21
    assert _gains(app, second)[3] is True


def test_gains_above_one_saturate(app):
    """Pinned current behavior: the Debayer output is clamped to [0, 1], so
    gains > 1 saturate bright values."""
    app.load_float(np.full((32, 48), 0.7, dtype=np.float32))
    app.add_effect("Debayer", RGB=True, AUTO=False, GAIN_R=1.0, GAIN_G=2.0, GAIN_B=1.2)
    out = app.export()
    assert np.all(out[..., 1] == 1.0), "G (0.7 x 2) should saturate at 1.0"
    assert np.allclose(out[..., 0], 0.7, atol=1e-6) and np.allclose(out[..., 2], 0.84, atol=1e-6)


# --- View geometry -------------------------------------------------------------

def _readout_pixel(app, cx, cy):
    m = re.match(r"^\((\d+), (\d+)\)", app.readout(cx, cy))
    return (int(m.group(1)), int(m.group(2))) if m else None


def _wheel(app, cx, cy, delta):
    app.js("""
        R.gl.canvas.dispatchEvent(new WheelEvent('wheel',
            {clientX: arg[0], clientY: arg[1], deltaY: arg[2], bubbles: true, cancelable: true}));
        await frames(3);
    """, [cx, cy, delta])


def test_zoom_keeps_the_pixel_under_the_cursor(app):
    """Wheel zoom anchors on the cursor: the readout names the same image
    pixel before and after each step, and the view never leaves the image."""
    app.load_float(np.random.default_rng(0).random((300, 400, 3)).astype(np.float32))
    app.set_view(3.0, (0.5, 0.5))
    for fx, fy, delta in [(0.3, 0.6, -300), (0.7, 0.4, -250), (0.5, 0.65, 200), (0.4, 0.45, -300)]:
        cx, cy = app.client_point(fx, fy)
        before = _readout_pixel(app, cx, cy)
        _wheel(app, cx, cy, delta)
        assert _readout_pixel(app, cx, cy) == before, f"pixel under cursor moved (zoom step {delta})"
        r = app.js("return R.getViewRegion();")
        span = app.js("const vr = R.getViewRect(); return R.getViewSpan(vr.w, vr.h);")
        assert r["u1"] - r["u0"] == pytest.approx(min(span[0], 1)) and r["v1"] - r["v0"] == pytest.approx(min(span[1], 1)), \
            "view extends outside the image"


def test_source_uv_to_client_inverts_client_to_source_uv(app):
    """The crop tool draws its box with sourceUVToClient; it must land where
    clientToSourceUV reads the same uv, at any zoom and pan."""
    app.load_float(np.random.default_rng(1).random((300, 500)).astype(np.float32))
    for zoom, center in [(1.0, (0.5, 0.5)), (3.0, (0.3, 0.6)), (7.5, (0.8, 0.2))]:
        app.set_view(zoom, center)
        for fx, fy in [(0.1, 0.2), (0.5, 0.5), (0.9, 0.75)]:
            cx, cy = app.client_point(fx, fy)
            back = app.js("""
                const {srcU, srcV} = R.clientToSourceUV(arg[0], arg[1]);
                const c = R.sourceUVToClient(srcU, srcV);
                return [c.clientX, c.clientY];
            """, [cx, cy])
            assert back == pytest.approx([cx, cy], abs=1e-6)


def test_pan_can_be_disabled(app):
    """Crop selection turns panning off; a drag then leaves the view alone."""
    app.load_float(np.random.default_rng(2).random((300, 500)).astype(np.float32))
    app.set_view(4.0, (0.5, 0.5))
    moved = app.js("""
        const c = R.gl.canvas, r = c.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const drag = () => {
            const before = [R.centerX, R.centerY];
            for (const [type, dx] of [['pointerdown', 0], ['pointermove', 40], ['pointerup', 40]]) {
                c.dispatchEvent(new PointerEvent(type,
                    {clientX: x + dx, clientY: y, pointerId: 1, button: 0, bubbles: true}));
            }
            return R.centerX !== before[0] || R.centerY !== before[1];
        };
        S.panInterface.enabled = false;
        const off = drag();
        S.panInterface.enabled = true;
        return [off, drag()];
    """)
    assert moved == [False, True]


@pytest.mark.parametrize("high_precision", [False, True])
def test_full_image_export_restores_display_canvas(app, high_precision):
    """Export Image renders offscreen at image size; afterwards the canvas
    must again fill the pane (it was once restored to the working-texture
    size, so the image drew into only part of the display)."""
    app.load_float(np.random.default_rng(4).random((300, 900)).astype(np.float32))
    before = app.js("return [R.gl.canvas.width, R.gl.canvas.height, R.getViewRect()];")
    app.js("await R.createExport(0, true, arg); S.requestRender(); await frames();", high_precision)
    after = app.js("return [R.gl.canvas.width, R.gl.canvas.height, R.getViewRect()];")
    assert after == before


# --- Default image ---------------------------------------------------------------

def test_startup_and_close_image_show_the_bayer_pattern(app):
    """The app opens on the bayer rggb test pattern (there is no pattern
    picker), and Close Image goes back to it."""
    state = "return [document.getElementById('activeFile').innerText, R.source.width, R.source.height];"
    assert app.js("return document.getElementById('test-pattern-select');") is None
    assert app.js(state) == ["bayer rggb test pattern", 2048, 2048]
    app.load_float(np.random.default_rng(3).random((300, 400)).astype(np.float32))
    assert app.js("return [R.source.width, R.source.height];") == [400, 300]
    after = app.js("""
        document.getElementById('closeImage').click();
        for (let i = 0; i < 200 && R.source?.width !== 2048; i++) await frames(1);
    """ + state)
    assert after == ["bayer rggb test pattern", 2048, 2048]


# Snapshot of the source and toolbar: corners of the displayed pixels, size,
# and which toolbar buttons are usable.
_GEOM_STATE = """
    const d = R.source.data, w = R.source.width, h = R.source.height;
    const tb = document.getElementById('geometryToolbar');
    return {
        w, h, corners: [d[0], d[w - 1], d[(h - 1) * w], d[h * w - 1]],
        visible: getComputedStyle(tb).display !== 'none',
        disabled: [...tb.querySelectorAll('button')].filter(b => b.disabled).map(b => b.id),
        status: document.getElementById('geom-status').innerText,
    };
"""


def _click(app, button_id):
    app.js("document.getElementById(arg).click(); await frames(3);", button_id)


def test_geometry_toolbar_works_on_the_startup_pattern(app):
    """Crop / rotate / flip apply to the start-up Bayer pattern (made in JS,
    no PDR product), with undo, reset, and Close Image back to the
    untransformed pattern."""
    start = app.js(_GEOM_STATE)
    assert start["visible"]
    assert start["disabled"] == ["geom-undo", "geom-reset"]
    assert start["status"] == "full 2048×2048 array"
    tl, tr, bl, br = start["corners"]

    _click(app, "geom-cw")
    rotated = app.js(_GEOM_STATE)
    # clockwise: the old bottom-left is now the top-left, etc.
    assert rotated["corners"] == [bl, tl, br, tr]
    assert rotated["disabled"] == []
    assert "rot90" in rotated["status"]

    _click(app, "geom-flipH")
    assert app.js(_GEOM_STATE)["corners"] == [tl, bl, tr, br]

    _click(app, "geom-undo")
    _click(app, "geom-undo")
    assert app.js(_GEOM_STATE) == start

    # crop to view after zooming in: a smaller array, traced to the original
    app.set_view(zoom=4.0, center=(0.25, 0.25))
    _click(app, "geom-crop-view")
    cropped = app.js(_GEOM_STATE)
    assert cropped["w"] < 2048 and cropped["h"] < 2048
    assert "[orig (" in app.readout(*app.client_point(0.5, 0.5))

    _click(app, "geom-reset")
    reset = app.js(_GEOM_STATE)
    assert (reset["w"], reset["h"], reset["corners"]) == (2048, 2048, start["corners"])
    assert reset["disabled"] == ["geom-reset"]  # undo can take back the reset

    _click(app, "geom-ccw")
    closed = app.js("""
        document.getElementById('closeImage').click();
        const undo = document.getElementById('geom-undo');
        for (let i = 0; i < 200 && !undo.disabled; i++) await frames(1);
    """ + _GEOM_STATE)
    assert closed == start


def test_dropped_browser_image_hides_the_geometry_toolbar(app):
    """A browser-decoded image has no float array to crop or rotate."""
    out = app.js("""
        const cv = new OffscreenCanvas(2, 2);
        cv.getContext('2d').fillRect(0, 0, 2, 2);
        const blob = await cv.convertToBlob({type: 'image/png'});
        const dt = new DataTransfer();
        dt.items.add(new File([blob], 'pic.png', {type: 'image/png'}));
        for (const type of ['dragenter', 'dragover', 'drop']) {
            document.body.dispatchEvent(new DragEvent(type, {dataTransfer: dt, bubbles: true, cancelable: true}));
        }
        for (let i = 0; i < 200 && R.source?.width !== 2; i++) await frames(1);
        return getComputedStyle(document.getElementById('geometryToolbar')).display;
    """)
    assert out == "none"
    # and Close Image brings it back with the pattern
    shown = app.js("""
        document.getElementById('closeImage').click();
        for (let i = 0; i < 200 && R.source?.width !== 2048; i++) await frames(1);
        await frames(2);
        return getComputedStyle(document.getElementById('geometryToolbar')).display;
    """)
    assert shown != "none"

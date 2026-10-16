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

"""
Open-file dialog: which staged file PDR reads first, where window drops go,
and that drops stage files (once) without loading anything until "Open".
"""
import pytest

OPENFILE = "const O = await import('/components/openfile.js');"

# Dispatch a synthetic drop of empty files with the given names on a target.
DROP = """
    const dt = new DataTransfer();
    for (const n of arg.names) dt.items.add(new File([new Uint8Array(4)], n));
    const target = arg.selector ? document.querySelector(arg.selector) : document.body;
    for (const type of ['dragenter', 'dragover', 'drop']) {
        target.dispatchEvent(new DragEvent(type, {dataTransfer: dt, bubbles: true, cancelable: true}));
    }
    await frames(2);
"""

STATE = """
    const modal = document.getElementById('open-file-modal');
    return {
        open: modal.style.display === 'block',
        title: document.getElementById('open-file-title').textContent,
        staged: Array.from(document.querySelectorAll('#staged-list .staged-name'),
                           (e) => e.textContent),
        primary: Array.from(document.querySelectorAll('#staged-list .primary-tag'),
                            (e) => e.closest('li').querySelector('.staged-name').textContent),
        radios: document.querySelectorAll('#staged-list input[type=radio]').length,
        leftover: document.getElementById('leftover-note').hidden
            ? null : document.getElementById('leftover-note').textContent,
        openDisabled: document.getElementById('open-staged').disabled,
        checked: document.querySelectorAll('#staged-list input[type=radio]:checked').length,
    };
"""


@pytest.mark.parametrize("names, expected", [
    (["a.img"], {"index": 0, "ambiguous": False}),
    (["a.img", "a.xml"], {"index": 1, "ambiguous": False}),
    (["A.IMG", "A.LBL"], {"index": 1, "ambiguous": False}),
    (["a.xml", "b.xml"], {"index": 0, "ambiguous": True}),
    (["A.IMG", "A.FMT"], {"index": 0, "ambiguous": True}),
])
def test_pick_primary(app, names, expected):
    assert app.js(OPENFILE + "return O.pickPrimary(arg);", names) == expected


@pytest.mark.parametrize("names, expected", [
    (["a.png"], "browser"),
    (["a.JPEG"], "browser"),
    (["a.IMG"], "pdr"),
    (["a.png", "a.xml"], "pdr"),
    (["a.png", "b.png"], "pdr"),
])
def test_route_window_drop(app, names, expected):
    assert app.js(OPENFILE + "return O.routeWindowDrop(arg);", names) == expected


def _drop(app, names, selector=None):
    app.js(DROP, {"names": names, "selector": selector})


def _state(app):
    return app.js(STATE)


def test_dialog_stages_files_one_at_a_time(app):
    app.page.click("#open-pdr-dialog")
    _drop(app, ["obs.img"], "#drop-zone")
    _drop(app, ["obs.xml"], "#drop-zone")
    s = _state(app)
    assert s["open"] and s["title"] == "Open With PDR"
    # each drop is staged exactly once (the window handler ignores it)
    assert s["staged"] == ["obs.img", "obs.xml"]
    assert s["primary"] == ["obs.xml"]
    assert s["radios"] == 0 and not s["openDisabled"]


def test_ambiguous_primary_offers_a_choice(app):
    app.page.click("#open-pdr-dialog")
    _drop(app, ["a.xml", "b.xml"], "#drop-zone")
    s = _state(app)
    assert s["radios"] == 2
    assert app.page.is_visible("#primary-hint")
    # nothing is chosen for the user, so Open waits for a choice
    assert s["checked"] == 0 and s["openDisabled"]
    app.page.locator("#staged-list li", has_text="b.xml").locator("input[type=radio]").check()
    s = _state(app)
    assert s["checked"] == 1 and not s["openDisabled"]


def test_clicking_drop_zone_opens_file_chooser(app):
    app.page.click("#open-pdr-dialog")
    with app.page.expect_file_chooser() as chooser:
        app.page.click("#drop-zone")
    assert chooser.value.is_multiple()


def test_same_name_replaces(app):
    app.page.click("#open-pdr-dialog")
    _drop(app, ["obs.img", "obs.img"], "#drop-zone")
    assert _state(app)["staged"] == ["obs.img"]


def test_window_drop_opens_pdr_dialog_and_keeps_leftovers(app):
    _drop(app, ["obs.img"])
    s = _state(app)
    assert s["open"] and s["staged"] == ["obs.img"] and s["leftover"] is None
    app.page.keyboard.press("Escape")
    assert not _state(app)["open"]
    _drop(app, ["obs.xml"])
    s = _state(app)
    assert s["staged"] == ["obs.img", "obs.xml"]
    assert s["leftover"] == "1 file(s) from earlier"
    app.page.click("#clear-staged")
    s = _state(app)
    assert s["staged"] == [] and s["leftover"] is None and s["openDisabled"]


def test_window_drop_ignored_while_another_modal_is_open(app):
    app.page.click("#open-help-modal")
    _drop(app, ["obs.img"])
    assert not _state(app)["open"]


def test_lone_image_window_drop_uses_browser_reader(app):
    # a lone PNG goes straight to the browser reader, without the dialog
    app.js("""
        const cv = new OffscreenCanvas(2, 2);
        cv.getContext('2d').fillRect(0, 0, 2, 2);
        const blob = await cv.convertToBlob({type: 'image/png'});
        const dt = new DataTransfer();
        dt.items.add(new File([blob], 'pic.png', {type: 'image/png'}));
        for (const type of ['dragenter', 'dragover', 'drop']) {
            document.body.dispatchEvent(new DragEvent(type, {dataTransfer: dt, bubbles: true, cancelable: true}));
        }
        await frames(2);
    """)
    assert not _state(app)["open"]
    assert app.page.text_content("#activeFile") == "pic.png"

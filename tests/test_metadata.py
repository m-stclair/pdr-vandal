"""
Metadata panel: shows a product's labels and headers (PDS4, PDS3, VICAR,
FITS, ...) as trees or raw text, one section each, searchable, and hidden
when there are none. Pyodide is stubbed in browser tests, so the
panel is fed a fixture label directly.
"""
LABEL = {
    "kind": "pds4",
    "tree": {"key": "Product", "children": [
        {"key": "Identification_Area", "children": [
            {"key": "title", "value": "Moon <test>"},
        ]},
        {"key": "Lens", "children": [
            {"key": "focal", "value": "400", "unit": "mm"},
            {"key": "focal", "value": "200", "unit": "mm"},
        ]},
    ]},
    "raw": "<Product>\n  <title>Moon &lt;test&gt;</title>\n</Product>\n",
}

SET = """
    const P = (await import('/glitch.js')).metadataPanel;
    P.panel.open = true;
    P.setLabel(arg);
    return null;
"""


def _text(app):
    return app.js("return document.getElementById('metaBody').innerText;")


def test_hidden_without_label_and_shown_with_one(app):
    app.js(SET, LABEL)
    assert app.js("return document.getElementById('metadataPanel').hidden") is False
    app.js("(await import('/glitch.js')).metadataPanel.clear(); return null;")
    assert app.js("return document.getElementById('metadataPanel').hidden") is True


def test_tree_shows_fields_units_and_repeats(app):
    app.js(SET, LABEL)
    text = _text(app)
    assert "Moon <test>" in text
    assert "focal [1]" in text and "focal [2]" in text
    assert "400 mm" in text


NESTED = {
    "kind": "pds4",
    "tree": {"key": "Product", "children": [
        {"key": "Identification_Area", "children": [
            {"key": "title", "value": "Moon"},
        ]},
        {"key": "Imaging", "children": [
            {"key": "Color_Processing", "children": [
                {"key": "Black_Reference_Point", "children": [
                    {"key": "Color_Bayer", "children": [
                        {"key": "red_dn", "value": "1008"},
                    ]},
                ]},
            ]},
        ]},
    ]},
    "raw": "black one\nblack two\n",
}

QUERY = "(await import('/glitch.js')).metadataPanel.setQuery(arg); return null;"
STATUS = "return document.getElementById('metaStatus').innerText"
CURRENT = "return document.querySelector('#metaBody mark.current')?.closest('.meta-row, summary').innerText"
KEY = """
    const input = document.getElementById('metaSearch');
    input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', shiftKey: arg, bubbles: true}));
    return null;
"""


def test_search_keeps_the_whole_tree_and_opens_matches(app):
    app.js(SET, LABEL)
    app.js(QUERY, "200")
    # nothing is hidden: the other rows are all still in the DOM
    rows = app.js("return [...document.querySelectorAll('#metaBody .meta-row')].map(r => r.innerText)")
    assert len(rows) == 3
    assert app.js(STATUS) == "1 / 1"
    assert app.js("return document.querySelector('#metaBody mark').closest('details').open")
    app.js(QUERY, "zzz")
    assert app.js(STATUS) == "no matches"
    assert app.js("return document.getElementById('metaNext').disabled")
    assert app.js("return document.querySelectorAll('#metaBody .meta-row').length") == 3


def test_matching_section_can_be_descended_into(app):
    app.js(SET, NESTED)
    app.js(QUERY, "black")
    assert app.js(STATUS) == "1 / 1"
    # the matching section is open, and its (non-matching) contents are present
    assert app.js("return document.querySelector('#metaBody mark').closest('details').open")
    rows = app.js("return [...document.querySelectorAll('#metaBody .meta-row')].map(r => r.textContent)")
    assert any(r.startswith("red_dn") for r in rows)
    # sub-sections that don't match stay closed until the user opens them
    assert app.js("""
        const inner = [...document.querySelectorAll('#metaBody details')]
            .find(d => d.firstElementChild.innerText === 'Color_Bayer');
        return inner.open;""") is False


def test_enter_and_buttons_step_through_matches(app):
    app.js(SET, LABEL)
    app.js(QUERY, "focal")
    assert app.js(STATUS) == "1 / 2"
    assert app.js(CURRENT).startswith("focal [1]")
    app.js(KEY, False)
    assert app.js(STATUS) == "2 / 2" and app.js(CURRENT).startswith("focal [2]")
    app.js(KEY, False)
    assert app.js(STATUS) == "1 / 2"            # wraps
    app.js(KEY, True)
    assert app.js(STATUS) == "2 / 2"            # shift+enter goes back, wrapping
    app.js("document.getElementById('metaPrev').click(); return null;")
    assert app.js(STATUS) == "1 / 2"
    app.js("document.getElementById('metaNext').click(); return null;")
    assert app.js(STATUS) == "2 / 2"
    assert app.js("return document.getElementById('metadataPanel').open") is True


def test_stepping_reopens_folded_sections(app):
    app.js(SET, NESTED)
    app.js(QUERY, "red_dn")
    app.js("document.querySelector('#metaBody details').open = false; return null;")
    app.js(KEY, False)
    assert app.js("return document.querySelector('#metaBody mark.current').getClientRects().length") > 0


def test_stepping_works_in_raw_mode_and_resets_on_mode_switch(app):
    app.js(SET, NESTED)
    app.js(QUERY, "black")
    app.js("document.querySelector('#metaMode [data-mode=raw]').click(); return null;")
    assert app.js(STATUS) == "1 / 2"
    app.js(KEY, False)
    assert app.js(STATUS) == "2 / 2"
    app.js("document.querySelector('#metaMode [data-mode=tree]').click(); return null;")
    assert app.js(STATUS) == "1 / 1"


def test_raw_mode_shows_raw_label(app):
    app.js(SET, LABEL)
    app.js("document.querySelector('#metaMode [data-mode=raw]').click(); return null;")
    assert "<title>Moon &lt;test&gt;</title>" in _text(app)
    # toggling a mode must not fold the panel
    assert app.js("return document.getElementById('metadataPanel').open") is True


PDS3 = {
    "kind": "pds3",
    "tree": {"key": "x.IMG", "children": [
        {"key": "INSTRUMENT_STATE_PARMS", "children": [
            {"key": "EXPOSURE_DURATION", "value": "20.6", "unit": "ms"},
        ]},
    ]},
    "raw": "ODL_VERSION_ID = ODL3\nGROUP = <b>\nEND\n",
}


def test_pds3_label_raw_text_and_kind(app):
    app.js(SET, PDS3)
    assert "20.6 ms" in _text(app)
    assert app.js("return document.getElementById('metaKind').innerText") == "PDS3"
    assert app.js("return document.querySelector('#metaMode [data-mode=raw]').innerText") == "raw"
    app.js("document.querySelector('#metaMode [data-mode=raw]').click(); return null;")
    text = _text(app)
    assert "GROUP = <b>" in text      # shown verbatim, not parsed as markup
    app.js("(await import('/glitch.js')).metadataPanel.setQuery('odl3'); return null;")
    assert app.js("return document.getElementById('metaStatus').innerText") == "1 / 1"
    app.js(SET, LABEL)
    assert app.js("return document.getElementById('metaKind').innerText") == "PDS4"


MULTI = {"sections": [
    {"kind": "PDS4", "title": "v.xml", "error": None,
     "tree": {"key": "Product", "children": [
         {"key": "Identification_Area", "children": [{"key": "title", "value": "Moon"}]},
     ]},
     "raw": "<Product>\n  <title>Moon</title>\n</Product>\n"},
    {"kind": "VICAR", "title": "header in v.VIC", "error": None,
     "tree": {"key": "header in v.VIC", "children": [
         {"key": "System", "children": [{"key": "LBLSIZE", "value": "280"}]},
         {"key": "PROPERTY CAMERA", "children": [{"key": "NOTE", "value": "it's <b>"}]},
     ]},
     "raw": "LBLSIZE=280\nNOTE='it''s <b>'\n"},
    {"kind": "FITS", "title": "f.fits", "error": None,
     "tree": {"key": "f.fits", "children": [
         {"key": "HDU 0 (PRIMARY)", "children": [
             {"key": "EXPTIME", "value": "20.6", "comment": "[s] exposure <time>"},
         ]},
     ]},
     "raw": "EXPTIME =                 20.6 / [s] exposure <time>\n"},
    {"kind": "VICAR", "title": "IMAGE_HEADER in C.IMG", "tree": None, "raw": None,
     "error": "ValueError: no LBLSIZE at byte 0"},
    {"kind": "TIFF", "title": "t.tif", "tree": None, "raw": "partial <raw>\n",
     "error": "KeyError: 'broken'"},
    {"note": "3 more data files not inspected for headers."},
]}

SECTIONS = "return [...document.querySelectorAll('#metaBody details.meta-section')]" \
           ".map(d => ({title: d.firstElementChild.innerText, open: d.open}))"
RAW_MODE = "document.querySelector('#metaMode [data-mode=raw]').click(); return null;"


def test_badge_joins_the_kinds_of_every_section(app):
    app.js(SET, MULTI)
    assert app.js("return document.getElementById('metaKind').innerText") == "PDS4 + VICAR + FITS + TIFF"
    assert app.js("return document.getElementById('metadataPanel').hidden") is False


def test_each_section_is_its_own_closed_group(app):
    app.js(SET, MULTI)
    assert app.js(SECTIONS) == [
        {"title": "PDS4 — v.xml", "open": False},
        {"title": "VICAR — header in v.VIC", "open": False},
        {"title": "FITS — f.fits", "open": False},
        {"title": "VICAR — IMAGE_HEADER in C.IMG", "open": False},
        {"title": "TIFF — t.tif", "open": False},
    ]
    assert "3 more data files not inspected" in _text(app)
    # a search opens just the sections holding a match
    app.js(QUERY, "lblsize")
    opened = [s["title"] for s in app.js(SECTIONS) if s["open"]]
    assert opened == ["VICAR — header in v.VIC", "VICAR — IMAGE_HEADER in C.IMG"]


def test_unreadable_section_says_why_and_points_to_raw(app):
    app.js(SET, MULTI)
    errors = app.js("return [...document.querySelectorAll('#metaBody .meta-error')].map(e => e.textContent)")
    assert errors == [
        "Couldn't read VICAR (IMAGE_HEADER in C.IMG): ValueError: no LBLSIZE at byte 0.",
        "Couldn't read TIFF (t.tif): KeyError: 'broken'. Its text is under \"raw\".",
    ]


def test_pane_shows_a_failed_read_instead_of_hiding(app):
    app.js("""
        const P = (await import('/glitch.js')).metadataPanel;
        P.panel.open = true;
        P.setError('Error: boom');
        return null;
    """)
    assert app.js("return document.getElementById('metadataPanel').hidden") is False
    assert app.js("return document.getElementById('metaKind').innerText") == ""
    assert "Couldn't read this product's labels: Error: boom." in _text(app)


def test_fits_comments_are_shown_and_searchable(app):
    app.js(SET, MULTI)
    app.js(QUERY, "exposure")
    assert app.js(STATUS) == "1 / 1"
    assert app.js("return document.querySelector('#metaBody mark').closest('.meta-comment') !== null")
    assert "[s] exposure <time>" in _text(app)


def test_raw_mode_divides_sections_and_copies_all_of_them(app):
    app.js(SET, MULTI)
    app.js(RAW_MODE)
    text = _text(app)
    for divider in ["=== PDS4 — v.xml ===", "=== VICAR — header in v.VIC ===",
                    "=== FITS — f.fits ===", "=== TIFF — t.tif ==="]:
        assert divider in text
    assert "NOTE='it''s <b>'" in text and "partial <raw>" in text
    assert "(Couldn't read VICAR (IMAGE_HEADER in C.IMG)" in text
    copied = app.js("""
        let got = null;
        Object.defineProperty(navigator, 'clipboard', {configurable: true,
            value: {writeText: async t => { got = t; }}});
        document.getElementById('metaCopy').click();
        await frames(2);
        return got;
    """)
    assert copied.startswith("=== PDS4 — v.xml ===\n<Product>")
    assert "=== FITS — f.fits ===" in copied and "3 more data files" in copied


def test_untrusted_text_stays_text_in_every_mode(app):
    app.js(SET, MULTI)
    app.js("document.querySelectorAll('#metaBody details').forEach(d => d.open = true); return null;")
    assert app.js("return document.querySelector('#metaBody b, #metaBody time, #metaBody raw')") is None
    assert "it's <b>" in _text(app)
    app.js(RAW_MODE)
    assert app.js("return document.querySelector('#metaBody b, #metaBody time, #metaBody raw')") is None


OVERFLOW = """
    const pane = document.getElementById('rightPane');
    const stack = document.getElementById('effectStack');
    pane.scrollTop = pane.scrollHeight;
    const p = pane.getBoundingClientRect(), s = stack.getBoundingClientRect();
    return {
        overflowY: getComputedStyle(pane).overflowY,
        overflows: pane.scrollHeight > pane.clientHeight + 1,
        stackBottomVisible: s.bottom <= p.bottom + 1,
        headerHeight: document.getElementById('effectStackHeader').getBoundingClientRect().height,
        minHeader: parseFloat(getComputedStyle(document.documentElement).fontSize) * 8,
    };
"""


def test_sidebar_scrolls_when_open_panels_overflow(app):
    app.page.set_viewport_size({"width": 1280, "height": 600})
    app.js(SET, LABEL)
    # an effect gives the stack some height; both panels are open
    # (a real instance: a raw registry entry on the stack breaks the render loop)
    app.add_effect("Debayer")
    app.js("S.requestUIDraw(); await frames(); return null;")
    result = app.js(OVERFLOW)
    assert result["overflowY"] == "auto"
    assert result["overflows"]
    assert result["stackBottomVisible"]          # reachable by scrolling
    assert result["headerHeight"] >= result["minHeader"] - 1


def test_sidebar_has_no_scrollbar_when_everything_fits(app):
    app.page.set_viewport_size({"width": 1280, "height": 1400})
    app.js("(await import('/glitch.js')).metadataPanel.clear(); return null;")
    assert app.js(OVERFLOW)["overflows"] is False

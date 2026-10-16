# vandal

`vandal` provides an visual effect chain GUI for image enhancement and
defacement, optionally including animation via sidechained LFOs. It is very 
fast and has a number of aesthetic capabilities not widely available in other 
software.

Although `vandal` is at working beta status, I make no firm guarantees about
its stability or completeness. This is a recreational project intended for
aesthetic and entertainment purposes. No documentation is available for 
`vandal`, and `vandal` has no self-tests.

A live version is available at: https://m-stclair.github.io/vandal/. Note that 
If accessed from a mobile device, `vandal` runs in "pocket mode", offering preset
and random effect chain _application_, but not _editing_ -- like an animated
"image filter app".

## Running locally

`vandal` is a static site with no install step, but it uses ES modules, so it
has to be served over HTTP rather than opened as a `file://` URL. From the
repository root:

```sh
python build.py            # only needed after editing anything in shaders/
python -m http.server 8000
```

Then open http://localhost:8000/.

- `build.py` copies `shaders/` into `build/shaders/` with content-hashed
  filenames, writes `build/shader_manifest.json`, and regenerates
  `cache-worker.js`. The app loads shaders only from `build/`, so changes to
  `shaders/` have no effect until you rebuild.
- Your browser may keep using cached copies of JavaScript files after you edit
  them. Hard-reload (Cmd/Ctrl+Shift+R) or tick "Disable cache" in the DevTools
  Network tab while developing.
- Loading PDS products (via [pdr](https://github.com/MillionConcepts/pdr))
  runs in the browser through Pyodide, which is fetched from a CDN, so that
  feature needs network access.

## Testing

The test suite targets scientific and data accuracy rather than complete
coverage: the decorrelation stretch against marslab, Bayer demosaicking, PDR
normalization, exported data values, and the pixel value readout. Results are
checked against independent references (a vendored copy of marslab's DCS, the
published Malvar-He-Cutler coefficients, the raw input data) and mathematical
properties, not against golden images or the app's own output. Browser tests
drive the real app in headless Chromium, because the stretches and
demosaicking run on the GPU.

One-time setup, from the repository root:

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r tests/requirements.txt
playwright install chromium
```

Running:

```sh
pytest                      # everything (under a minute)
pytest -m "not browser"     # pure-Python tests only; no Playwright needed
pytest tests/test_dcs.py    # one area; or select tests with -k <name>
```

- Run `python build.py` first if you changed anything in `shaders/`: tests,
  like the app, load shaders from `build/`.
- Tests start their own local server and headless browser, and need no
  network access; you don't need `python -m http.server` running.
- `tests/reference/marslab_dcs.py` is a verbatim copy of marslab 0.9.28's
  decorrelation stretch, pinned on purpose. Update it deliberately, by
  re-extracting it from a new marslab release. It needs numpy < 2.5, where
  `np.linalg.eig` still returns real values for real input.
- A failing accuracy test reports the largest error, where it occurs, and the
  tolerance, e.g. `max |error| 4.351e-06 at (23, 33, 2) ...; tolerance 0.0e+00`.
- When adding a test, compare against an independent reference or a property
  the result must satisfy, never against the implementation's own output.

## License

`vandal` bears the BSD 3-Clause License, copyright Michael St. Clair. You can 
do nearly anything you want with this code. Some ancillary shaders bear 
additional licenses (attached as headers to individual files).

Contributions are not solicited at this time. Feel free to file Issues.

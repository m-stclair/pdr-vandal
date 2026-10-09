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

## License

`vandal` bears the BSD 3-Clause License, copyright Michael St. Clair. You can 
do nearly anything you want with this code. Some ancillary shaders bear 
additional licenses (attached as headers to individual files).

Contributions are not solicited at this time. Feel free to file Issues.

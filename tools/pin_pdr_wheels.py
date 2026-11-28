"""
Regenerate pdr-packages.js: the exact packages Pyodide loads for PDR.

pdr.js loads these with `loadPyodide({packages})` instead of running
micropip in the browser, which saves the PyPI round trips (~1.5 s) on the
first file open. The cost is that pdr no longer updates itself, so this
script is what brings in a new pdr. A weekly GitHub Action
(.github/workflows/pin-pdr.yml) runs it and opens a PR when the pins change.

It resolves pdr[pillow,fits] the way micropip would:
- a requirement Pyodide's distribution provides is listed by name, and
  Pyodide loads its dependencies from its own lockfile;
- anything else is pinned to the newest pure-Python (py3-none-any) wheel on
  PyPI that satisfies every constraint seen on it, and its dependencies are
  resolved the same way.
A requirement neither can satisfy (e.g. a compiled package Pyodide doesn't
ship) is an error, so a new pdr dependency can't go missing silently.

Usage:  python tools/pin_pdr_wheels.py [--pdr VERSION]
        python tools/pin_pdr_wheels.py --requirements
The first form needs network access; both need the `packaging` library.
--requirements prints the current PyPI pins as pip requirements (e.g.
`pdr[fits,pillow]==1.4.4`), so CI can test pdrview.py against the pdr the site loads.
"""

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

from packaging.markers import default_environment
from packaging.requirements import Requirement
from packaging.specifiers import SpecifierSet
from packaging.utils import canonicalize_name
from packaging.version import InvalidVersion, Version

ROOT = Path(__file__).resolve().parent.parent
PDR_JS = ROOT / "pdr.js"
OUTPUT = ROOT / "pdr-packages.js"
ROOT_REQUIREMENT = "pdr[pillow,fits]"
PYODIDE_URL_RE = re.compile(
    r"https://cdn\.jsdelivr\.net/pyodide/v([^/]+)/full/pyodide\.mjs"
)
PURE_WHEEL_RE = re.compile(r"-py[0-9.]*3[0-9.]*-none-any\.whl$")
# a pinned wheel URL in pdr-packages.js: .../<name>-<version>-<tags>.whl"
PINNED_WHEEL_RE = re.compile(r'/([^/-]+)-([^/-]+)-[^/]+\.whl"')


def get_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": "pin-pdr-wheels"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def pyodide_version():
    match = PYODIDE_URL_RE.search(PDR_JS.read_text())
    if match is None:
        sys.exit(f"could not find the Pyodide CDN URL in {PDR_JS}")
    return match.group(1)


def marker_environment(python_version):
    """Marker values for Pyodide's Python, so platform-conditional
    requirements resolve as they would in the browser."""
    env = default_environment()
    major_minor = ".".join(python_version.split(".")[:2])
    env.update(
        python_version=major_minor,
        python_full_version=python_version,
        implementation_version=python_version,
        sys_platform="emscripten",
        platform_system="Emscripten",
        platform_machine="wasm32",
        os_name="posix",
    )
    return env


def applies(requirement, env, extras):
    if requirement.marker is None:
        return True
    # a marker without `extra` ignores it; one with it must match ours
    return any(
        requirement.marker.evaluate({**env, "extra": extra})
        for extra in (extras or {""})
    )


def newest_pure_wheel(name, specifier):
    """(version, url, requires_dist) of the newest release of `name` that
    satisfies `specifier` and has a non-yanked pure-Python wheel."""
    index = get_json(f"https://pypi.org/pypi/{name}/json")
    candidates = []
    for version_string, files in index["releases"].items():
        try:
            version = Version(version_string)
        except InvalidVersion:
            continue
        if version.is_prerelease or version not in specifier:
            continue
        wheels = [
            f for f in files
            if not f.get("yanked") and PURE_WHEEL_RE.search(f["filename"])
        ]
        if wheels:
            candidates.append((version, wheels[0]["url"]))
    if not candidates:
        sys.exit(
            f"{name}{specifier} is not in Pyodide's distribution and has no "
            "pure-Python wheel on PyPI; Pyodide can't load it"
        )
    version, url = max(candidates)
    release = get_json(f"https://pypi.org/pypi/{name}/{version}/json")
    return version, url, release["info"].get("requires_dist") or []


def resolve(pdr_version=None):
    pyver = pyodide_version()
    lock = get_json(f"https://cdn.jsdelivr.net/pyodide/v{pyver}/full/pyodide-lock.json")
    in_pyodide = {canonicalize_name(k): v for k, v in lock["packages"].items()}
    env = marker_environment(lock["info"]["python"])

    root = Requirement(ROOT_REQUIREMENT)
    if pdr_version:
        root.specifier = SpecifierSet(f"=={pdr_version}")
    pending = [(root, "(root)")]
    from_pyodide = {}   # name -> version
    from_pypi = {}      # name -> (version, url)
    while pending:
        requirement, required_by = pending.pop()
        name = canonicalize_name(requirement.name)
        where = f"{requirement} (required by {required_by})"
        if name in in_pyodide:
            version = Version(in_pyodide[name]["version"])
            if version not in requirement.specifier:
                sys.exit(f"Pyodide {pyver} ships {name} {version}, but {where}")
            from_pyodide[name] = version
            continue
        if name in from_pypi:
            if from_pypi[name][0] not in requirement.specifier:
                sys.exit(f"pinned {name} {from_pypi[name][0]} conflicts with {where}")
            continue
        version, url, requires = newest_pure_wheel(name, requirement.specifier)
        from_pypi[name] = (version, url)
        for spec in requires:
            dependency = Requirement(spec)
            if applies(dependency, env, requirement.extras):
                pending.append((dependency, f"{name} {version}"))
    return pyver, from_pyodide, from_pypi


def render(pyver, from_pyodide, from_pypi):
    pins = ", ".join(f"{name} {version}" for name, (version, _) in sorted(from_pypi.items()))
    lines = [
        "// Generated by tools/pin_pdr_wheels.py; do not edit by hand.",
        f"// The packages pdr.js loads for {ROOT_REQUIREMENT} on Pyodide {pyver}.",
        f"// Pinned from PyPI: {pins}.",
        "// Names are from Pyodide's distribution, which loads their dependencies;",
        "// URLs are pure-Python wheels it doesn't ship.",
        "export const PDR_PACKAGES = [",
    ]
    lines += [f'    "{name}",' for name in sorted(from_pyodide)]
    lines += [f'    "{url}",' for _, (_, url) in sorted(from_pypi.items())]
    lines.append("];")
    return "\n".join(lines) + "\n"


def pinned_requirements():
    """The PyPI pins in pdr-packages.js as pip requirement strings."""
    if not OUTPUT.exists():
        sys.exit(f"{OUTPUT} does not exist; run this script without --requirements")
    root = Requirement(ROOT_REQUIREMENT)
    requirements = []
    for name, version in PINNED_WHEEL_RE.findall(OUTPUT.read_text()):
        name = canonicalize_name(name)
        # pdr with the extras the site loads, e.g. pdr[fits,pillow]==1.4.4
        extras = f"[{','.join(sorted(root.extras))}]" if name == root.name else ""
        requirements.append(f"{name}{extras}=={version}")
    return requirements


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--pdr", metavar="VERSION",
                        help="pin this pdr version instead of the newest")
    parser.add_argument("--requirements", action="store_true",
                        help="print the current pins as pip requirements and exit")
    args = parser.parse_args()
    if args.requirements:
        print("\n".join(pinned_requirements()))
        return
    text = render(*resolve(args.pdr))
    old = OUTPUT.read_text() if OUTPUT.exists() else None
    if text == old:
        print(f"{OUTPUT.name} is up to date")
        return
    OUTPUT.write_text(text)
    print(f"wrote {OUTPUT.name}:\n{text}")


if __name__ == "__main__":
    main()

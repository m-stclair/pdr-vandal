"""
Generated build outputs must reference only files that are deployed. The
service worker's cache.addAll() is all-or-nothing, so a single missing asset
breaks its install (and with it shader caching / offline use).
"""
import json
import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def _tracked():
    out = subprocess.run(["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True)
    return set(out.stdout.split())


def _service_worker_assets():
    src = (REPO / "cache-worker.js").read_text()
    m = re.search(r"ASSETS_TO_CACHE\s*=\s*\[(.*?)\];", src, re.S)
    assert m, "ASSETS_TO_CACHE not found in cache-worker.js"
    return [p[2:] for p in re.findall(r"'([^']*)'", m.group(1))]   # strip "./"


def test_service_worker_assets_are_deployed_build_files():
    tracked = _tracked()
    assets = _service_worker_assets()
    assert assets, "service worker caches nothing"
    problems = [a for a in assets
                if not a.startswith("build/") or Path(a).name.startswith(".")
                or a not in tracked or not (REPO / a).is_file()]
    assert not problems, (
        f"{len(problems)} service-worker assets are not tracked build files "
        f"(they would 404 when deployed), e.g. {problems[:3]}")


def test_shader_manifest_entries_are_tracked():
    tracked = _tracked()
    manifest = json.loads((REPO / "build" / "shader_manifest.json").read_text())
    missing = [f"build/shaders/{v}" for v in manifest.values()
               if f"build/shaders/{v}" not in tracked]
    assert not missing, f"shader manifest names untracked files: {missing[:3]}"

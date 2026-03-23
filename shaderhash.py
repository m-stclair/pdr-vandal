import os
import hashlib
import shutil
import json

SRC_DIR = 'shaders'  # Source directory with original GLSL templates
OUT_DIR = 'build/shaders'  # Output directory for hashed copies
MANIFEST_PATH = 'build/shader_manifest.json'

manifest = {}

def hash_file(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:8]

def process_tree(src_root, out_root):
    if os.path.exists(out_root):
        shutil.rmtree(out_root)
    os.makedirs(out_root, exist_ok=True)

    for dirpath, _, filenames in os.walk(src_root):
        rel_dir = os.path.relpath(dirpath, src_root)
        out_dir = os.path.join(out_root, rel_dir)
        os.makedirs(out_dir, exist_ok=True)

        for fname in filenames:
            if not (fname.endswith('.glsl') or fname.endswith('.frag')):
                continue
            src_path = os.path.join(dirpath, fname)
            h = hash_file(src_path)
            name, ext = os.path.splitext(fname)
            hashed_name = f"{name}.{h}{ext}"
            out_path = os.path.join(out_dir, hashed_name)
            shutil.copy2(src_path, out_path)

            logical_key = os.path.normpath(os.path.join(rel_dir, fname)).replace("\\", "/")
            physical_path = os.path.normpath(os.path.join(rel_dir, hashed_name)).replace("\\", "/")
            manifest[logical_key] = physical_path


def hash_shaders():
    process_tree(SRC_DIR, OUT_DIR)
    os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)
    with open(MANIFEST_PATH, 'w') as f:
        json.dump(manifest, f, indent=2)



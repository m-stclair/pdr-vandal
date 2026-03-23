export async function loadShaderManifest() {
  const manifestURL = new URL("../build/shader_manifest.json", import.meta.url);
  const res = await fetch(manifestURL);
  if (!res.ok) throw new Error(`Failed to load shader manifest: ${res.status}`);
  return await res.json();
}

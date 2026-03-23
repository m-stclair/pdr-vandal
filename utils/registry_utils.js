export function generateEffectMetaFromModule(mod, filename) {
  const userMeta = mod.effectMeta || {};
  const id = userMeta.id || filename.replace(/\.js$/, "");

  // Try to guess a reasonable human-readable name
  const name = mod.name || id
    .replace(/_/g, " ")
    .replace(/\b(gl|svg)\b/i, m => m.toUpperCase())
    .replace(/\b\w/g, c => c.toUpperCase());

  const defaultConfig = mod.defaultConfig || {};
  const configKeys = Object.keys(defaultConfig);

  // Infer tags from available exports and config structure
  const inferredTags = [
    mod.shaderStuff ? "webgl" : null,
    configKeys.includes("hue") || configKeys.includes("saturation") ? "color" : null,
  ].filter(Boolean);

  return {
    id,
    name,
    group: userMeta.group || "Uncategorized",
    tags: [...new Set([...(userMeta.tags || []), ...inferredTags])],
    description: userMeta.description || "",
    backend: userMeta.backend || (mod.isGPU ? "webgl" : "cpu"),
    kind: userMeta.kind || (mod.apply ? "pixel" : "visual"),
    realtimeSafe: userMeta.realtimeSafe ?? true,
    ...userMeta, // allow other overrides
  };
}

export function makeRegistryEntry(mod, filename) {
    let concatMembers;
    if (mod.default) {
        concatMembers = {...mod.default, ...mod}
        mod = mod.default;
    } else {
        concatMembers = mod;
    }
    const meta = generateEffectMetaFromModule(concatMembers, filename);
    return {
        id: meta.id,
        name: meta.name,
        group: meta.group,
        tags: meta.tags,
        description: meta.description,
        animated: meta.animated,
        backend: meta.backend,
        realtimeSafe: meta.realtimeSafe,
        apply: mod.apply,
        styleHook: mod.styleHook,
        cleanupHook: mod.cleanupHook,
        defaultConfig: mod.defaultConfig,
        uiLayout: mod.uiLayout,
        initHook: mod.initHook ?? (() => Promise.resolve()),
        isGPU: mod.isGPU,
        meta,
    }
}
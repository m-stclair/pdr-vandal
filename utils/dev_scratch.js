// /** @type {{[name: string]: EffectModule}} */
// export const effectRegistry = Object.fromEntries(
//     flatEffects.map(({name, mod}) => [name, mod])
// );

// export const effectGroups = [
//     {
//         label: "Core Adjustments",
//         effects: [channelMixer, stretchEffect, bcsAdjustments, colorMap, affineTransform, channelMixerRGB]
//     },
//     {
//         label: "Structural",
//         effects: [contourSynth, colorShred, jointShred, edgeTrace, hillShade]
//     },
//     {
//         label: 'Color Effects',
//         effects: [posterize, reinhardTransfer, threshcycle]
//     },
//     {
//         label: "Disruptive / Desync",
//         effects: [delayLineGL, FIR, pixelsort, tileDesync, bandedFlip, warpNoise]
//     },
//     {
//         label: "Distortions",
//         effects: [pixelate.frag, wave, morphOp, rgbShiftSvg, blur, blur_svg]
//     },
//     {
//         label: "Patterns",
//         effects: [scanlines]
//     },
//     {
//         label: "System / Debug",
//         effects: [paletteDebug]
//     }
// ];



// const modules = await Promise.all(
//   effectFiles.map(async file => {
//     const url = new URL(`./effects/${file}`, import.meta.url).href;
//     const mod = await import(url);
//     const effectId = file.replace(/\.js$/, '');
//     return { effectId, mod: mod.default || mod };
//   })
// );
//
//
// for (const { effectId, mod } of modules) {
//   const keys = Object.keys(mod);
//   console.log(`${effectId}: ${keys.join(', ')}`);
// }

// function inferConfigType(config) {
//   const out = {};
//   for (const [key, val] of Object.entries(config)) {
//     const t = typeof val;
//     if (t === "number" || t === "boolean" || t === "string") {
//       out[key] = t;
//     } else if (val instanceof Array){
//         out[key] = "Array";
//     } else if (val === null) {
//         out[key] = "null";
//     } else {
//       out[key] = "unknown"; // fallback for null, object, etc.
//     }
//   }
//   return out;
// }
//
// for (const { effectId, mod } of modules) {
//   const inferred = inferConfigType(mod.defaultConfig || {});
//   console.log(`\n// ${effectId}`);
//   console.log(`export interface ${effectId.replace(/[^a-zA-Z0-9]/g, '_')}Config {`);
//   for (const [k, t] of Object.entries(inferred)) {
//     console.log(`  ${k}: ${t};`);
//   }
//   console.log('}');
// }

//
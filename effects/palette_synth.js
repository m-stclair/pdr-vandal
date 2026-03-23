import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {paletteprobe} from "./probes/paletteprobe.js";
import {webGLState} from "../utils/webgl_state.js";
import {blendControls} from "../utils/ui_configs.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum, hasChromaBoostImplementation} from "../utils/glsl_enums.js";
import {lab2Rgb, linear2SRGB} from "../utils/colorutils.js";
import {preprocessPalette} from "../utils/paletteutils.js";

function exportPalette(_config, palette) {
  const canvas = document.createElement("canvas");
  canvas.width = palette.length;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(palette.length, 1);

  // `palette` is a nested array like [[L, a, b_], [L, a, b_]],
  // with L, a, b in CIELAB units.
  for (let i = 0; i < palette.length; i++) {
      const L = palette[i][0] / 100;
      const a = (palette[i][1] + 128) / 255;
      const b_ = (palette[i][2] + 128) / 255;
      const [r, g, b] = lab2Rgb(L, a, b_).map((c) => Math.round(linear2SRGB(c) * 255));
      imageData.data.set([r, g, b, 255], i * 4);
  }
  ctx.putImageData(imageData, 0, 0);
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lut.png";
    link.click();
  });
}

const shaderPath = "palette_synth.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

//
async function makeProbe(fx, renderer) {
    const prb = {
        config: structuredClone(paletteprobe.config),
        initHook: paletteprobe.initHook,
        parent: fx,
        glState: new webGLState(
            renderer, `${fx.name}-probe`, `${fx.id}-probe`
        ),
        analyze: paletteprobe.analyze
    }
    await prb.initHook();
    fx.probe = prb;
}


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Palette Synth",

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            paletteSize, cycleOffset, softness, blendK,
            lumaWeight, chromaWeight, hueWeight, BLENDMODE,
            COLORSPACE, BLEND_CHANNEL_MODE, assignMode, blendAmount,
            showPalette, selectWeights,
            chromaBoost, deltaL, gammaC,
            blockSize, seed
        } = resolveAnimAll(instance.config, t)

        // TODO, maybe: there are some cases in which we don't need to recompute the
        //  palette -- when (1) we are the first active effect in the chain,
        //  (2) there hasn't been a base image swap, and (3) no parameters
        //  relevant to palette _selection_ have changed (e.g., someone
        //  changed a blend setting). but the probe is very cheap.
        const probe = instance.probe;
        const selectionWeights = {
            midtone: selectWeights[0],
            outlier: selectWeights[1],
            luma: selectWeights[2],
            hue: selectWeights[3],
        }
        let palette = probe.analyze(
            probe,
            inputTex,
            width,
            height,
            (paletteSize < 3 ? 3 : paletteSize) / 3,
            deltaL,
            gammaC,
            blockSize,
            seed,
            selectionWeights
        );
        const {paletteBlock, paletteFeatures} = preprocessPalette(palette, paletteSize);

        instance.config['exportPalette'] = palette;

        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},
            PaletteFeatures: {value: paletteFeatures, type: "UBO", binding: 0},
            PaletteBlock: {value: paletteBlock, type: "UBO", binding: 1},
            u_paletteSize: {value: palette.length, type: "int"},
            u_cycleOffset: {value: cycleOffset, type: "int"},
            u_softness: {value: softness, type: "float"},
            u_blendK: {value: blendK, type: "int"},
            u_lumaWeight: {value: lumaWeight, type: "float"},
            u_chromaWeight: {value: chromaWeight, type: "float"},
            u_hueWeight: {value: hueWeight, type: "float"},
            u_blendAmount: {value: blendAmount, type: "float"},
            u_chromaBoost: {type: "float", value: chromaBoost},
        };
        const defines = {
            BLENDMODE: BLENDMODE,
            COLORSPACE: COLORSPACE,
            APPLY_CHROMA_BOOST: hasChromaBoostImplementation(COLORSPACE),
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            ASSIGNMODE: {"nearest": 0, "blend": 1}[assignMode],
            SHOW_PALETTE: {"none": 0, "strip": 1}[showPalette]
        }
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },

    async initHook(fx, renderer) {
        await fragSources.load();
        await makeProbe(fx, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true,
    uiLayout: [
        {
            type: "group",
            kind: "collapse",
            label: "Palette Generation",
            collapsed: false,
            children: [
                {
                    type: "modSlider",
                    key: "paletteSize",
                    label: "size",
                    min: 3,
                    max: 42,
                    step: 3
                },
                {
                    type: "range",
                    key: "deltaL",
                    label: "Tint/Shade Delta",
                    min: 1,
                    max: 60,
                    step: 0.5
                },
                {
                    type: "range",
                    key: "gammaC",
                    label: "Chroma Gamma",
                    min: 0.1,
                    max: 2,
                    step: 0.1
                },
                {
                    type: "range",
                    key: "blockSize",
                    label: "Sample Width",
                    min: 1,
                    max: 5,
                    step: 1
                },
                {
                    type: "range",
                    key: "seed",
                    label: "Seed",
                    min: 0,
                    max: 500,
                    step: 1
                },
                {
                    type: "vector",
                    key: "selectWeights",
                    label: "Selection Weights",
                    min: 0,
                    max: 5,
                    step: 0.1,
                    length: 4,
                    subLabels: ["midtone", "outlier", "luma", "hue"]
                },
                {
                    type: "select",
                    key: "showPalette",
                    label: "Show Palette",
                    options: ["none", "strip"]
                },
            ]
        },
        {
            type: "select",
            key: "assignMode",
            label: "Assignment Mode",
            options: ["nearest", "blend"]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Perceptual Weights",
            children: [
                {
                    type: "modSlider",
                    key: "lumaWeight",
                    label: "Luma",
                    min: -0.2,
                    max: 3,
                    step: 0.01
                },
                {
                    type: "modSlider",
                    key: "chromaWeight",
                    label: "Chroma",
                    min: -0.2,
                    max: 3,
                    step: 0.01
                },
                {
                    type: "modSlider",
                    key: "hueWeight",
                    label: "Hue",
                    min: -0.2,
                    max: 3,
                    step: 0.01
                },

            ]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Palette Blending",
            showIf: {key: "assignMode", equals: "blend"},
            children: [
                {
                    type: "modSlider",
                    key: "blendK",
                    label: "Width",
                    min: 1,
                    max: 5,
                    step: 1
                },
                {
                    type: "modSlider",
                    key: "softness",
                    label: "Softness",
                    min: 0.5,
                    max: 4,
                    step: 0.05
                },
            ]
        },
        blendControls(),
        {
            type: "modSlider",
            key: "cycleOffset",
            label: "Cycle",
            min: 0,
            max: 100,
            step: 1
        },
        {
            type: 'button',
            key: 'exportPalette',
            label: "Export Palette",
            func: exportPalette
        },

    ],
    defaultConfig: {
        paletteSize: 15,
        deltaL: 30,
        gammaC: 1,
        cycleOffset: 0,
        softness: 1,
        blendK: 2,
        lumaWeight: 0.75,
        chromaWeight: 0.75,
        hueWeight: 0.25,
        selectWeights: [0, 0, 0.1, 0.2],
        assignMode: "blend",
        blendAmount: 1,
        BLENDMODE: BlendModeEnum.MIX,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL,
        COLORSPACE: ColorspaceEnum.RGB,
        showPalette: "none",
        chromaBoost: 1,
        blockSize: 3,
        seed: 1
    }
}

export const effectMeta = {
    group: "Color",
    tags: ["color", "gpu", "palette", "posterize"],
    description: "Highly configurable neoclassical posterization, controllable " +
        "on multiple perceptual axes, useful for everything from utilitarian " +
        "palette generation to brutal decimation to subtle lighting effects. ",
    backend: "gpu",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        BLEND_CHANNEL_MODE: {"always": BlendTargetEnum.ALL},
        showPalette: {"always": "none"},
        cycleOffset: {"min": 0, "max": 0, "aniMin": 0, "aniMax": 100},
        gammaC: {"min": 0.8, "max": 1.2}
    }
};

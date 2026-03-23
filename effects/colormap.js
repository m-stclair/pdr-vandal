import {cmapLuts, LUTSIZE, resampleLut} from "../utils/colormaps.js";
import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {
    BlendModeEnum,
    BlendTargetEnum,
    ColorspaceEnum
} from "../utils/glsl_enums.js";
import {blendControls} from "../utils/ui_configs.js";

const shaderPath = "colormap.frag";
const includePaths = {
    "colorconvert.glsl": "includes/colorconvert.glsl",
    "blend.glsl": "includes/blend.glsl"
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);


function importColormap(config, _ignoredValue, e, _fx, requestRender, requestUIDraw) {
    let file;
    if (!(e instanceof File)) {
        file = e.target.files[0];
    } else {
        file = e;
    }
    if (!file) return;
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, 1).data;
        const lutArr = resampleLut(data, "linear", LUTSIZE);
        cmapLuts[file.name.replace(/\..+$/, '')] = lutArr;
        config['colormap'] = file.name.replace(/\..+$/, '');
        requestRender();
        requestUIDraw();
    }
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Colormap",
    defaultConfig: {
        colormap: "orange_teal",
        chromaBoost: 1,
        reverse: false,
        blendAmount: 1,
        BLENDMODE: BlendModeEnum.MIX,
        COLORSPACE: ColorspaceEnum.RGB,
        BLEND_CHANNEL_MODE: BlendTargetEnum.ALL
    },
    uiLayout: [
        {
            type: "select",
            key: "colormap",
            label: "Colormap",
            get options() {
                return Object.keys(cmapLuts);
            }
        },
        {
            type: "checkbox",
            key: "reverse",
            label: "Reverse",
        },
        {
            type: "button",
            key: "importColormap",
            label: "Import Colormap",
            func: importColormap,
            inputType: "file"

        },
        blendControls()
    ],
    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {
            reverse, BLENDMODE, BLEND_CHANNEL_MODE, COLORSPACE, blendAmount,
            colormap, chromaBoost
        } = resolveAnimAll(instance.config, t);
        const uniformSpec = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_blendamount: {value: blendAmount, type: "float"},
            u_reverse: {value: reverse, type: "float"},
            u_chromaBoost: {type: "float", value: chromaBoost},
        };
        if (colormap !== instance.auxiliaryCache.lastCmapName) {
            let lutArr = cmapLuts[colormap];
            // this is intended to handle cases in which someone loads a
            // LUT as a small array using Apply LUT or similar
            if (lutArr.length !== LUTSIZE) {
                lutArr = resampleLut(lutArr, "linear", LUTSIZE);
            }
            instance.auxiliaryCache.cmapTex = instance.glState.getOrCreateLUT(colormap, lutArr);
        }
        instance.auxiliaryCache.lastCmapName = colormap;
        uniformSpec["u_cmap"] = {
            value: instance.auxiliaryCache.cmapTex,
            type: "texture2D",
            width: LUTSIZE,
            height: 1
        };
        const defines = {
            APPLY_CHROMA_BOOST: 0,
            BLENDMODE: BLENDMODE,
            BLEND_CHANNEL_MODE: BLEND_CHANNEL_MODE,
            COLORSPACE: COLORSPACE
        };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec, defines);
    },
    initHook: async (instance, renderer) => {
        instance.auxiliaryCache = {};
        await fragSources.load(instance, renderer);
    },
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
};

export const effectMeta = {
    group: "Color",
    tags: ["color", "colormap", "gpu", "lookup", "palette"],
    description: "Applies a colormap transformation using a 1D palette LUT. "
        + "Useful for remapping luminance or applying false color.",
    canAnimate: true,
    realtimeSafe: true,
    parameterHints: {
        BLEND_CHANNEL_MODE: {"always": BlendTargetEnum.ALL},
        blendAmount: {"min": 0.85, "max": 1}
    }
};

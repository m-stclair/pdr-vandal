import {resolveAnimAll} from "../utils/animutils.js";
import {loadFragInit} from "../utils/load_runner.js";
import {initGLEffect} from "../utils/gl.js";

const fragURL = [
    // new URL("/delayline.frag", import.meta.url),
];
fragURL.forEach((u) => u.searchParams.set("v", Date.now()));
const fragSource = loadFragInit(fragURL);


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "name",

    defaultConfig: {
        // p1: 32,
    },

    uiLayout: [
        // {key: "p1", label: "P1",  type: "modSlider", min: 0, max: 200},
    ],

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSource);
        const {} = resolveAnimAll(instance.config, t);


        /** @typedef {import('../glitchtypes.ts').UniformSpec} UniformSpec */
        /** @type {UniformSpec} */
        const uniformSpec = {
            u_resolution: {value: [width, height], type: "vec2"},

        };
        instance.glState.renderGL(inputTex, outputFBO, uniformSpec);

    },
    initHook: fragSource.load,
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    },
    glState: null,
    isGPU: true
}

export const effectMeta = {
  group: "groupname",
  tags: [],
  description: "",
  canAnimate: true,
  realtimeSafe: true,
};

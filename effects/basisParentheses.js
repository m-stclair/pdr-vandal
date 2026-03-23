import {resolveAnimAll} from "../utils/animutils.js";
import {initGLEffect, loadFragSrcInit} from "../utils/gl.js";
import {ColorspaceEnum, ColorspaceOpts, makeEnum} from "../utils/glsl_enums.js";
import {BasisConstructionError, gramSchmidt3, invertMat3} from "../utils/ortho.js";
import {convertAxisVector} from "../utils/colorutils.js";

const shaderPath = "basis_parentheses.frag"
const includePaths = {
    'colorconvert.glsl': 'includes/colorconvert.glsl',
    'blend.glsl': 'includes/blend.glsl',
    'color_projection.glsl': 'includes/color_projection.glsl',
    'basis_projection.glsl': 'includes/basis_projection.glsl',
};
const fragSources = loadFragSrcInit(shaderPath, includePaths);

const availableSpaceOpts = ColorspaceOpts.filter((o) => ["Lab", "RGB", "HSV"].includes(o.label))

const {
    enum: CCDebugEnum,
    names: CCDebugNames,
    options: CCDebugOpts
} = makeEnum([
    'CC_DEBUG_NONE',
    'CC_DEBUG_COORD',
    'CC_DEBUG_PER_CHANNEL',
    'CC_DEBUG_PALETTE',
])

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "basis()",

    defaultConfig: {
        mix1: [1, 0, 0],
        mix2: [0, 1, 0],
        mix3: [0, 0, 1],
        offset: [0, 0, 0],
        base1: [1, 0, 0],
        base2: [0, 1, 0],
        base3: [0, 0, 1],
        base1Space: ColorspaceEnum.RGB,
        base2Space: ColorspaceEnum.RGB,
        base3Space: ColorspaceEnum.RGB,
        CC_DEBUG_MODE: CCDebugEnum.CC_DEBUG_NONE,
        CC_DEBUG_CHANNEL: 0,
        workSpace: ColorspaceEnum.Lab
    },

    apply(instance, inputTex, width, height, t, outputFBO) {
        initGLEffect(instance, fragSources);
        const {config} = instance;
        const {
            mix1, mix2, mix3, base1, base2, base3, offset,
            CC_DEBUG_MODE, CC_DEBUG_CHANNEL,
            base1Space, base2Space, base3Space, workSpace
        } = resolveAnimAll(config, t);
        let orthoBasis, inv;
        const baseVecs = [
            convertAxisVector(base1, base1Space, workSpace),
            convertAxisVector(base2, base2Space, workSpace),
            convertAxisVector(base3, base3Space, workSpace),
        ]
        try {
            orthoBasis = gramSchmidt3(baseVecs);
            inv = invertMat3(orthoBasis);
        } catch (err) {
            if (err instanceof BasisConstructionError) {
                orthoBasis = config?.lastValidBasis ?? [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
                inv = config?.lastValidInverse ?? [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
            } else {
                throw err;
            }
        }

        config.lastValidBasis = orthoBasis;
        config.lastValidInverse = inv;

        /** @type {import('../glitchtypes.ts').UniformSpec} */
        const uniforms = {
            u_resolution: {type: "vec2", value: [width, height]},
            u_mix1: {type: "vec3", value: mix1},
            u_mix2: {type: "vec3", value: mix2},
            u_mix3: {type: "vec3", value: mix3},
            u_offset: {type: "vec3", value: offset},
            u_Basis: {type: "mat3", value: orthoBasis.flat()},
            u_invBasis: {type: "mat3", value: inv.flat()}
        };
        const defines = {
            CC_DEBUG_MODE: CC_DEBUG_MODE,
            CC_DEBUG_CHANNEL: CC_DEBUG_CHANNEL,
            // NOTE: we should never want to blend this, but if we do,
            //  this will collide.
            COLORSPACE: workSpace
        }
        instance.glState.renderGL(inputTex, outputFBO, uniforms, defines);
    },

    uiLayout: [
        {
            type: "group",
            label: "Basis",
            kind: "collapse",
            children: [
                {
                    key: "base1",
                    label: "Basis Vector 1",
                    type: "vector",
                    subLabels: ["C1", "C2", "C3"],
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                {
                    key: "base2",
                    label: "Basis Vector 2",
                    type: "vector",
                    subLabels: ["C1", "C2", "C3"],
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                {
                    key: "base3",
                    label: "Basis Vector 3",
                    type: "vector",
                    subLabels: ["C1", "C2", "C3"],
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
            ]
        },
        {
            type: "group",
            label: "Offset",
            kind: "collapse",
            children: [
                {
                    key: "offset",
                    label: "Offset",
                    type: "vector",
                    subLabels: ["C1", "C2", "C3"],
                    min: -1,
                    max: 1,
                    step: 0.01,
                },
            ]
        },
        {
            type: "group",
            label: "Colorspaces",
            kind: "collapse",
            children: [
                {
                    key: "workSpace",
                    label: "Working Space",
                    type: "select",
                    options: availableSpaceOpts
                },
                {
                    key: "base1Space",
                    label: "Basis 1 Colorspace",
                    type: "select",
                    options: availableSpaceOpts
                },
                {
                    key: "base2Space",
                    label: "Basis 2 Colorspace",
                    type: "select",
                    options: availableSpaceOpts
                },
                {
                    key: "base3Space",
                    label: "Basis 3 Colorspace",
                    type: "select",
                    options: availableSpaceOpts
                },
            ]
        },
        {
            type: "group",
            kind: "collapse",
            label: "Channel Mix",
            children:
                [
                    {
                        key: "mix1",
                        label: "Channel 1 Mix",
                        type: "vector",
                        subLabels: ["C1", "C2", "C3"],
                        min: -2,
                        max: 2,
                        step: 0.01,
                    },
                    {
                        key: "mix2",
                        label: "Channel 2 Mix",
                        type: "vector",
                        subLabels: ["C1", "C2", "C3"],
                        min: -2,
                        max: 2,
                        step: 0.01,
                    },
                    {
                        key: "mix3",
                        label: "Channel 3 Mix",
                        type: "vector",
                        subLabels: ["C1", "C2", "C3"],
                        min: -2,
                        max: 2,
                        step: 0.01,
                    },
                ]
        },
        {
            type: "group", kind:
                "collapse", label:
                "Debug", children:
                [
                    {key: "CC_DEBUG_MODE", label: "Debug Mode", type: "select", options: CCDebugOpts},
                    {key: "CC_DEBUG_CHANNEL", label: "Debug Channel", type: "select", options: ["0", "1", "2"]}
                ]
        }

    ],
    cleanupHook(instance) {
        instance.glState.renderer.deleteEffectFBO(instance.id);
    }
    ,
    initHook: fragSources.load,
    glState:
        null,
    isGPU:
        true
}

export const effectMeta = {
    group: "Operators",
    tags: ["color", "mix", "axes"],
    description: "Design and mix the custom color basis of your dreams. " +
        "mint-brick-aubergine? Go ahead.",
    canAnimate: false,
    realtimeSafe: true,
    parameterHints: {"CC_DEBUG_MODE": {"always": CCDebugEnum.CC_DEBUG_NONE}},
    // TODO: would prefer otherwise but tedious to hint a non-degenerate basis
    notInRandom: true
};


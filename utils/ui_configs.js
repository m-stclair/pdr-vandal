import {
    BlendModeOpts,
    BlendTargetOpts,
    ColorspaceEnum,
    ColorspaceOpts,
    ZoneShapeEnum,
    ZoneShapeOpts
} from "./glsl_enums.js";

export function blendControls() {
    return {
            type: 'group',
            color: "#1a0011",
            collapsed: true,
            label: 'Blend Options',
            kind: 'collapse',
            children: [
                {key: "blendAmount", label: "Blend", type: "modSlider", min: 0, max: 1, step: 0.01},
                {key: 'BLENDMODE', label: 'Blend Mode', type: 'Select', options: BlendModeOpts},
                {key: 'COLORSPACE', label: 'Blend Colorspace', type: 'Select', options: ColorspaceOpts},
                {key: 'BLEND_CHANNEL_MODE', label: 'Blend Target', type: 'Select', options: BlendTargetOpts},
                {
                    key: "chromaBoost",
                    label: 'Chroma Boost',
                    type: 'modSlider',
                    min: 0,
                    max: 2.5,
                    steps: 200,
                    // ugh
                    showIf: [
                        {key: "NEVER", equals: 'NEVER'},
                        {key: "COLORSPACE", notEquals: ColorspaceEnum.RGB},
                        {key: "COLORSPACE", notEquals: ColorspaceEnum.HSV},
                        {key: "COLORSPACE", notEquals: ColorspaceEnum.HSL},
                        {key: "COLORSPACE", notEquals: ColorspaceEnum.Opponent},
                        {key: "COLORSPACE", notEquals: ColorspaceEnum.YCbCr},
                    ]
                }
            ]
        }
}

export function zoneControls() {
    return {
        type: 'group',
        kind: 'collapse',
        label: 'Zone Settings',
        children: [
            {
                type: "select",
                key: "ZONESHAPE",
                label: "Zone Shape",
                options: ZoneShapeOpts
            },
            {type: "modSlider", key: "zoneCX", label: "X", min: 0, max: 1, steps: 200},
            {type: "modSlider", key: "zoneSX", label: "X Size", min: 0, max: 1, steps: 200},
            {type: "modSlider", key: "zoneCY", label: "Y", min: 0, max: 1, steps: 200},
            {type: "modSlider", key: "zoneSY", label: "Y Size", min: 0, max: 1, steps: 200},
            {
                type: "modSlider",
                key: "zoneEllipseN",
                label: "Shape",
                min: 0.9,
                max: 10,
                steps: 200,
                showIf: {"key": "ZONESHAPE", "equals": ZoneShapeEnum.SUPERELLIPSE}
            },
            {type: "modSlider", key: "zoneSoftness", label: "Softness", min: 0, max: 1, steps: 200},
            {type: "modSlider", key: "zoneAngle", label: "Angle", min: 0, max: Math.PI * 2, steps: 200},
        ]
    }
}

export const group = (label, children, options = {}) => ({
    type: 'group',
    label,
    kind: 'collapse',
    ...options,
    children
});
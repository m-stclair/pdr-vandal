/**
 * @param {string[]} names
 * @returns {{
 *   enum: Record<string, number>,
 *   names: Record<number, string>,
 *   options: { label: string, value: number }[]
 * }}
 */
export function makeEnum(names) {
    const e = {};
    const namesMap = {};
    names.forEach((name, i) => {
        e[name] = i;
        namesMap[i] = name;
    });
    const opts = names.map((name, i) => ({label: name, value: i}));
    return {
        enum: Object.freeze(e),
        names: Object.freeze(namesMap),
        options: Object.freeze(opts)
    };
}

export const {
    enum: ColorspaceEnum,
    names: ColorspaceNames,
    options: ColorspaceOpts
} = makeEnum([
    'RGB',
    'Lab',
    'LCH',
    'HSV',
    'Opponent',
    'YCbCr',
    'HSL',
    'JzAzBz',
    'JCHz'
]);

// Blend modes
export const {
    enum: BlendModeEnum,
    names: BlendModeNames,
    options: BlendModeOpts
} = makeEnum([
    'REPLACE',
    'MIX',
    'ADD',
    'MULTIPLY',
    'SCREEN',
    'OVERLAY',
    'DARKEN',
    'LIGHTEN',
    'DIFFERENCE',
    'SOFT_LIGHT',
    'HARD_LIGHT'
]);

// Posterize modes
export const {
    enum: PosterizeEnum,
    names: PosterizeModeNames,
    options: PosterizeModeOpts
} = makeEnum([
    'NONE',
    'UNIFORM',
    'LOG',
    'BIAS',
    'BAYER'
]);

// Blend targets
export const {
    enum: BlendTargetEnum,
    names: BlendTargetNames,
    options: BlendTargetOpts
} = makeEnum([
    'ALL',
    'CHANNEL_1',
    'CHANNEL_2',
    'CHANNEL_3'
]);

// Gate modes
export const {
    enum: GateModeEnum,
    names: GateModeNames,
    options: GateModeOpts
} = makeEnum([
    'NONE',
    'SOFT',
    'HARD',
    'BURST'
]);


// Zone shapes
export const {
    enum: ZoneShapeEnum,
    names: ZoneShapeNames,
    options: ZoneShapeOpts
} = makeEnum([
    'BOX',
    'VERTICAL',
    'SUPERELLIPSE',
    'HORIZONTAL'
]);

export const {
    enum: DebugModeEnum,
    names: DebugModeNames,
    options: DebugModeOpts
} = makeEnum([
    'MODE_UV_GRADIENT',
    'MODE_TEXEL_CHECKER',
    'MODE_LINEAR_INDEX',
    'MODE_PIXEL_GRID',
    'MODE_CENTER_DEVIATION',
    'MODE_OOB_NAN_HIGHLIGHT',
    'MODE_COLOR_CHECK'
])

export const {
    enum: DebugColorModeEnum,
    names: DebugColorModeNames,
    options: DebugColorModeOpts
} = makeEnum([
    'COLOR_MODE_CHANNEL',
    'COLOR_MODE_SPACE',
    'COLOR_MODE_ROUND_TRIP',
    'COLOR_MODE_DERIV',
    'COLOR_MODE_CLIP',
    'COLOR_MODE_HEAT'
])

export function hasChromaBoostImplementation(cspace) {
    // TODO: this conversion shouldn't happen here
    cspace = Number(cspace);
    return Number([ColorspaceEnum.LCH, ColorspaceEnum.Lab].includes(cspace))
}
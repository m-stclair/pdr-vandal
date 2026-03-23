export type Int = number;

export type UIControl =
    | {
    type: "range";
    key: string;
    label?: string;
    min: number;
    max: number;
    step?: number;
    steps?: number;
    scale?: "log" | "lin" | "exp";
    scaleFactor?: number;
}
| {
    type: "modSlider";
    key: string;
    label?: string;
    min: number;
    max: number;
    step?: number;
    steps?: number;
    scale?: "log" | "lin" | "exp";
    scaleFactor?: number;
}
| {
    type: "vector";
    key: string;
    label?: string;
    min: number;
    max: number;
    step?: number;
    steps?: number;
    scale?: "log" | "lin" | "exp";
    scaleFactor?: number;
    subLabels: string[]; // must be of length === "length"
    length: Int;
}
| {
    type: "matrix";
    key: string;
    label?: string;
    size: [Int, Int],
    min: number;
    max: number;
    step?: number;
    steps?: number;
    scale?: "log" | "lin" | "exp";
    scaleFactor?: number;
    rowLabels: (config: ConfigObject) => string[];  // must have length === size[0]
    colLabels: (config: ConfigObject) => string[];  // must have length === size[1]
}
    | {
    type: "select";
    key: string;
    label?: string;
    options: Array<{ label: string; value: any }> | Array<string>;
}
    | {
    type: "checkbox";
    key: string;
    label?: string;
};

export type SVGUrl = string;

export type ConfigPrimitive = number | boolean | string | null;
export type ConfigObject = Record<string, ConfigPrimitive | Array<number>>;

export type EffectPresetMap = {
  [effectId: string]: {
    [label: string]: ConfigObject;
  };
};


export type BaseEffect = {
    name: string;
    defaultConfig: ConfigObject;
    uiLayout: UIControl[];
    cleanupHook?: (instance: EffectInstance) => void;
    initHook?: (instance: EffectInstance) => void;
};

export type ApplyFunc = (
    instance: EffectInstance,
    data: Float32Array,
    width: Int,
    height: Int,
    t: number,
    inputKey: string
) => Float32Array;

export type PixelEffect = BaseEffect & {
    apply: ApplyFunc;
    styleHook?: never;
};

export type VisualEffect = BaseEffect & {
    styleHook: (instance: EffectInstance) => SVGUrl;
    apply?: never;
};

export type EffectModule = PixelEffect | VisualEffect;

export interface EffectInstance {
    id: string;
    name: string;
    config: ConfigObject;
    apply?: ApplyFunc;
    styleHook?: (instance: EffectInstance) => SVGUrl;
    cleanupHook?: (instance: EffectInstance) => void;
    initHook?: (instance: EffectInstance) => Promise<void> | void;
    uiLayout: UIControl[];
    disabled: boolean;
    // optional per-instance derived data cache
    auxiliaryCache?: Record<string, any>;
    // user-edited name
    label?: string;
    solo: boolean;
    requires_f32: boolean;
    pinned?: boolean;
}

export interface EffectMeta {
  id: string;
  name: string;
  group: string;
  tags: string[];
  description: string;
  backend: "cpu" | "webgl" | "hybrid";
  canAnimate: boolean;
  animatedByDefault?: boolean; // Default config has non-zero mod depth or animation hook
  realtimeSafe: boolean;
  // Optional extensions
  experimental?: boolean;
  hidden?: boolean;
  kind: "pixel" | "visual";
  notPickable?: boolean
}

export interface RegistryEntry {
  id: string;
  name: string;
  group: string;
  tags: string[];
  description: string;
  backend: "cpu" | "webgl" | "hybrid";
  animated: boolean;
  realtimeSafe: boolean;
  defaultConfig: ConfigObject;
  uiLayout: UIControl[];
  apply?: ApplyFunc;
  styleHook?: (instance: EffectInstance) => SVGUrl;
  cleanupHook?: (instance: EffectInstance) => void;
  initHook?: (instance: EffectInstance) => Promise<void> | void;
  meta: EffectMeta;
}

export type UniformDatum =
    | { type: "float", value: number }
    | { type: "int", value: number }
    | { type: "bool", value: boolean }
    | { type: "vec2", value: [number, number] }
    | { type: "vec3", value: [number, number, number] }
    | { type: "vec4", value: [number, number, number, number] }
    | { type: "mat2", value: Float32Array | number[] }  // length 4
    | { type: "mat3", value: Float32Array | number[] }  // length 9
    | { type: "mat4", value: Float32Array | number[] }  // length 16
    | { type: "floatArray", value: Float32Array | number[] }
    | { type: "intArray", value: Int32Array | number[] }
    | { type: "vec2Array", value: Float32Array | number[] }
    | { type: "vec3Array", value: Float32Array | number[] }
    | { type: "vec4Array", value: Float32Array | number[] }
    | { type: "texture2D", value: Uint8Array, width: number, height: number };


export type UniformSpec = Record<string, UniformDatum>;
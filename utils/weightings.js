import {clampedPositive} from "./mathutils.js";

export const weightFns = {
    xRamp: (x, _y) => 0.5 + 0.5 * x,
    yRamp: (_x, y) => 0.5 + 0.5 * y,
    xgaussian: (x, _y) => Math.exp(-4 * x * x),
    ygaussian: (_x, y) => Math.exp(-4 * y * y),
    diagonal: (x, y) => Math.exp(-4 * Math.pow(x - y, 2)),
    verticalBias: (_x, y) => Math.exp(-4 * y * y),
    uniform: (_x, _y) => 1,
    linear: clampedPositive((x, y) => 1 - Math.sqrt(x * x + y * y)),
    quadratic: clampedPositive((x, y) => 1 - (x * x + y * y)),
    gaussian: (x, y) => Math.exp(-4 * (x * x + y * y)),
}

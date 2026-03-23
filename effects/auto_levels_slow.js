// effects/stretch_effect.js

import {channelwise, normalizeRange, approxPercentileClip, stddevClip} from '../utils/stretch.js';

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Slow Auto Levels",

    defaultConfig: {
        method: "percentile", // "minmax", "stddev"
        paramA: 1.0,           // For percentile: lower percentile, for stddev: sigma
        paramB: 99.0,          // For percentile: upper percentile
        channelwise: true
    },

    apply(instance, data, width, height, _t) {
        const config = instance.config;
        let func, params, result;

        switch (config.method) {
            case "stddev":
                func = stddevClip;
                params = [config.paramA];
                break;
            case "minmax":
                func = normalizeRange;
                params = [];
                break;
            case "percentile":
                func = approxPercentileClip;
                params = [config.paramA, config.paramB];
        }

        if (config.channelwise) {
            result = channelwise(data, width, height, func, ...params);
        } else {
            result = func(data, ...params);
        }
        return result;

    },

    uiLayout: [
        {
            type: "select",
            key: "method",
            label: "Stretch Method",
            options: [
                {value: "percentile", label: "Percentile Clip"},
                {value: "stddev", label: "Standard Deviation Clip"},
                {value: "minmax", label: "Min/Max Normalize"}
            ]
        },
        {
            type: "range",
            key: "paramA",
            label: "Param A",
            min: 1,
            max: 100,
            step: 0.5
        },
        {
            type: "range",
            key: "paramB",
            label: "Param B",
            min: 1,
            max: 100,
            step: 0.5
        },
        {
            type: "checkbox",
            key: "channelwise",
            label: "Channelwise"
        }
    ]
};

export const effectMeta = {
  group: "Utility",
  tags: ["normalize", "stretch", "contrast", "cpu"],
  description: "Slow dynamic range adjustment with percentile, sigma, or full-range " +
      "linear stretch. The faster GL version is preferred in most cases.",
  canAnimate: false,
  realtimeSafe: false,
};
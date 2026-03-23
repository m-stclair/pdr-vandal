/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "RGB Shift (SVG)",

    defaultConfig: {
        rdx: 0, rdy: 0,
        gdx: 0, gdy: 0,
        bdx: 0, bdy: 0
    },

    uiLayout: [
        {type: "range", key: "rdx", label: "Red X", min: -10, max: 10, step: 1},
        {type: "range", key: "rdy", label: "Red Y", min: -10, max: 10, step: 1},
        {type: "range", key: "gdx", label: "Green X", min: -10, max: 10, step: 1},
        {type: "range", key: "gdy", label: "Green Y", min: -10, max: 10, step: 1},
        {type: "range", key: "bdx", label: "Blue X", min: -10, max: 10, step: 1},
        {type: "range", key: "bdy", label: "Blue Y", min: -10, max: 10, step: 1}
    ],

    styleHook(instance) {
        const dom_id = `rgbshiftFilter-${instance.id}`;
        const config = instance.config;
        let filter = document.getElementById(dom_id);
        if (!filter) {
            const svgRoot = document.querySelector("svg#filter-defs");
            const defs = svgRoot.querySelector("defs");
            filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
            filter.setAttribute("id", dom_id);
            filter.setAttribute("x", "0%");
            filter.setAttribute("y", "0%")
            filter.setAttribute("width", "100%");
            filter.setAttribute("height", "100%");
            defs.appendChild(filter);

            const channels = ["red", "green", "blue"];
            for (const channel of channels) {
                const comp = document.createElementNS("http://www.w3.org/2000/svg", "feComponentTransfer");
                comp.setAttribute("in", "SourceGraphic");
                comp.setAttribute("result", channel);

                const funcs = ["R", "G", "B"];
                for (const f of funcs) {
                    const fe = document.createElementNS("http://www.w3.org/2000/svg", `feFunc${f}`);
                    fe.setAttribute("type", "table");
                    fe.setAttribute("tableValues", f === channel[0].toUpperCase() ? "0 1" : "0 0");
                    comp.appendChild(fe);
                }
                filter.appendChild(comp);

                const offset = document.createElementNS("http://www.w3.org/2000/svg", "feOffset");
                offset.setAttribute("in", channel);
                offset.setAttribute("result", `${channel[0]}Shift`);
                filter.appendChild(offset);
            }

            const blendRG = document.createElementNS("http://www.w3.org/2000/svg", "feBlend");
            blendRG.setAttribute("in", "rShift");
            blendRG.setAttribute("in2", "gShift");
            blendRG.setAttribute("mode", "screen");
            blendRG.setAttribute("result", "rg");
            filter.appendChild(blendRG);

            const blendFinal = document.createElementNS("http://www.w3.org/2000/svg", "feBlend");
            blendFinal.setAttribute("in", "rg");
            blendFinal.setAttribute("in2", "bShift");
            blendFinal.setAttribute("mode", "screen");
            filter.appendChild(blendFinal);
        }

        // Update offsets
        const offsets = filter.querySelectorAll("feOffset");
        offsets[0].setAttribute("dx", config.rdx);
        offsets[0].setAttribute("dy", config.rdy);
        offsets[1].setAttribute("dx", config.gdx);
        offsets[1].setAttribute("dy", config.gdy);
        offsets[2].setAttribute("dx", config.bdx);
        offsets[2].setAttribute("dy", config.bdy);

        return `url(#${dom_id})`;
    },

    cleanupHook(instance) {
        const dom_id = `rgbshiftFilter-${instance.id}`;
        const filter = document.getElementById(dom_id);
        if (filter) filter.remove();
    }
};

export const effectMeta = {
  group: "Stylize",
  tags: ["rgb", "shift", "displacement", "svg", "color"],
  description: "Shifts R, G, and B channels independently using SVG filters " +
      "to create a chromatic aberration effect.",
  backend: "cpu",
  kind: "visual",
  realtimeSafe: true,
};
/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Blur (SVG)",
    defaultConfig: {
        sigma: 4
    },

    uiLayout: [
        {type: "modSlider", key: "sigma", label: "Sigma", min: 1, max: 15, step: 1}
    ],

    styleHook(instance) {
        const dom_id = `blurFilter-${instance.id}`;
        let filter = document.getElementById(dom_id);
        if (!filter) {
            const svg = document.querySelector("svg");
            filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
            filter.setAttribute("id", dom_id);
            svg.appendChild(filter);

            const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
            blur.setAttribute("in", "SourceGraphic");
            filter.appendChild(blur);
        }
        const SVG_NS = "http://www.w3.org/2000/svg";
        const blur = filter.getElementsByTagNameNS(SVG_NS, "feGaussianBlur")[0];
        blur.setAttribute("stdDeviation", instance.config.sigma);
        return `url(#${dom_id})`;
    },

    cleanupHook(instance) {
        const dom_id = `blurFilter-${instance.id}`;
        const filter = document.getElementById(dom_id);
        if (filter) filter.remove();
    }
}

export const effectMeta = {
  id: "banded_flip",
  name: "Blur",
  group: "Distortion",
  tags: ["bands", "invert", "temporal", "displacement", "svg"],
  description: "Blurs.",
  backend: "cpu",
  realtimeSafe: true,
};
/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "MorphOp (SVG)",

    defaultConfig: {
        operator: "dilate",      // "dilate", "erode", "arithmetic"
        radius: 1,
        threshold: 0.5,
        useThreshold: false,
        k1: 0, k2: 0, k3: 1, k4: 0 // for arithmetic
    },

    styleHook(instance) {
        const id = `morphOpFilter-${instance.id}`;
        const existing = document.getElementById(id);
        if (existing) {
            updateMorphFilter(existing, instance.config);
            return `url(#${id})`;
        }

        const svgNS = "http://www.w3.org/2000/svg";
        const filter = document.createElementNS(svgNS, "filter");
        filter.setAttribute("id", id);
        filter.setAttribute("x", "0%");
        filter.setAttribute("y", "0%");
        filter.setAttribute("width", "100%");
        filter.setAttribute("height", "100%");
        updateMorphFilter(filter, instance.config);
        document.querySelector("svg").appendChild(filter);
        return `url(#${id})`;
    },

    cleanupHook(instance) {
        const id = `morphOpFilter-${instance.id}`;
        const existing = document.getElementById(id);
        if (existing) existing.remove();
    },

    uiLayout: [
        {type: "select", key: "operator", label: "Operator", options: ["dilate", "erode", "arithmetic"]},
        {type: "checkbox", key: "useThreshold", label: "Threshold First"},
        {type: "range", key: "threshold", label: "Threshold Level", min: 0, max: 1, step: 0.01},
        {type: "range", key: "radius", label: "Radius", min: 1, max: 10, step: 1},
        {type: "range", key: "k1", label: "k1 (A*B)", min: 0, max: 2, step: 0.1},
        {type: "range", key: "k2", label: "k2 (A)", min: -1, max: 1, step: 0.1},
        {type: "range", key: "k3", label: "k3 (B)", min: -1, max: 1, step: 0.1},
        {type: "range", key: "k4", label: "k4 (const)", min: -1, max: 1, step: 0.1}
    ]
};

function updateMorphFilter(filter, config) {
    const {operator, useThreshold, threshold, radius, k1, k2, k3, k4} = config;
    const thresh = Math.max(0, Math.min(1, threshold));

    filter.innerHTML = `
    <feColorMatrix type="matrix" in="SourceGraphic" result="gray"
      values="0.2126 0.7152 0.0722 0 0
              0.2126 0.7152 0.0722 0 0
              0.2126 0.7152 0.0722 0 0
              0      0      0      1 0" />
    ${useThreshold ? `
      <feComponentTransfer in="gray" result="binary">
        <feFuncR type="discrete" tableValues="${thresh} 1"/>
        <feFuncG type="discrete" tableValues="${thresh} 1"/>
        <feFuncB type="discrete" tableValues="${thresh} 1"/>
      </feComponentTransfer>
    ` : `<feComponentTransfer in="gray" result="binary" />`}
    ${operator === "dilate" || operator === "erode" ? `
      <feMorphology in="binary" operator="${operator}" radius="${radius}" result="out"/>
    ` : operator === "arithmetic" ? `
      <feComposite in="binary" in2="SourceGraphic" operator="arithmetic"
        k1="${k1}" k2="${k2}" k3="${k3}" k4="${k4}" result="out"/>
    ` : ''}
    <feBlend in="SourceGraphic" in2="out" mode="darken"/>
  `;
}

export const effectMeta = {
  group: "Edge",
  tags: ["svg", "morphology", "binarize", "filter"],
  description: "Applies SVG-based morphological operations such as dilate and " +
      "erode. Best used on binary images, but can optionally threshold inline",
  backend: "cpu",
  canAnimate: false,
  realtimeSafe: true,
};
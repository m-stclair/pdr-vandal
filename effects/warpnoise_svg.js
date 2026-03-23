/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Warp Noise",

    defaultConfig: {
        baseFrequency: 0.05,
        numOctaves: 2,
        scale: 20,
        seed: 0,
        animate: false
    },
    uiLayout: [
        {
            key: 'baseFrequency',
            type: 'range',
            label: 'Base Frequency',
            min: 0.001,
            max: 1,
            step: 0.001,
        },
        {
            key: 'numOctaves',
            type: 'range',
            label: 'Octaves',
            min: 1,
            max: 5,
            step: 1,
        },
        {
            key: 'scale',
            type: 'range',
            label: 'Displacement Scale',
            min: 1,
            max: 100,
            step: 1,
        },
        {
            key: 'seed',
            type: 'range',
            label: 'Seed',
            min: 0,
            max: 1000,
            step: 1,
        },
        {
            key: 'animate',
            type: 'checkbox',
            label: 'Animate Noise',
        }
    ],
    styleHook(instance) {
        const {baseFrequency, numOctaves, scale, seed, animate} = instance.config;

        const filterId = `warpNoise-${instance.id}`;
        let filter = document.getElementById(filterId);
        if (!filter) {
            const svg = document.querySelector("svg");
            filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
            filter.setAttribute("id", filterId);
            filter.setAttribute('x', '-50%');
            filter.setAttribute('y', '-50%');
            filter.setAttribute('width', '200%');
            filter.setAttribute('height', '200%');
            svg.appendChild(filter);
            const turbulence = document.createElementNS(filter.namespaceURI, 'feTurbulence');
            turbulence.setAttribute('type', 'turbulence');

            const displacement = document.createElementNS(filter.namespaceURI, 'feDisplacementMap');
            displacement.setAttribute('in', 'SourceGraphic');
            displacement.setAttribute('in2', 'noise');

            filter.appendChild(turbulence);
            filter.appendChild(displacement);
        }
        const SVG_NS = "http://www.w3.org/2000/svg";
        const turbulence = filter.getElementsByTagNameNS(SVG_NS, "feTurbulence")[0];
        const displacement = filter.getElementsByTagNameNS(SVG_NS, "feDisplacementMap")[0];


        displacement.setAttribute('scale', scale);
        displacement.setAttribute('xChannelSelector', 'R');
        displacement.setAttribute('yChannelSelector', 'G');
        turbulence.setAttribute('baseFrequency', `${baseFrequency}`);
        turbulence.setAttribute('numOctaves', numOctaves);
        turbulence.setAttribute('seed', seed);
        turbulence.setAttribute('result', 'noise');
        if (animate) turbulence.setAttribute('baseFrequency', `${baseFrequency} ${baseFrequency}`);
        return `url(#${filterId})`
    },

    cleanupHook(instance) {
        const dom_id = `warpNoise-${instance.id}`;
        const filter = document.getElementById(dom_id);
        if (filter) filter.remove();
    }
}

export const effectMeta = {
  group: "Stylize",
  tags: ["warp", "noise", "svg", "displacement"],
  description: "Applies a resonant noise field with an SVG filter. Can produce " +
      "soft, organic noise or gentle mosaic effects.",
  backend: "cpu",
  kind: "visual",
  canAnimate: false,
  realtimeSafe: true,
};
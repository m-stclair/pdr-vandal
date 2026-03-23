import {valmap} from "./helpers.js";

function pseudoRandom(n) {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

export function resolveAnim(p, t) {
    if (typeof p !== "object" || p instanceof Array) return p;
    const {value = 0, mod} = p;
    if (!mod || mod.type === "none") return value;

    const {
        type,
        freq = 1,
        phase = 0,
        scale = 1,
        offset = 0,
        duty = 0.05,
        seed = 0
    } = mod;

    const phi = (t * freq + phase) % 1;
    const lastPhi = ((t - 1 / 30) * freq + phase) % 1;

    let wave = 0;

    switch (type) {
        case "sine":
            wave = Math.sin(phi * 2 * Math.PI);
            break;
        case "square":
            wave = phi < 0.5 ? 1 : -1;
            break;
        case "triangle":
            wave = 2 * Math.abs(2 * phi - 1) - 1;
            break;
        case "saw":
            wave = 2 * phi - 1;
            break;
        case "hold": {
            const step = Math.floor(t * freq);
            wave = 2 * pseudoRandom(step + seed) - 1;
            break;
        }
        case "impulse": {
            const withinPulse = phi < duty;
            const wasInPulse = lastPhi < duty && lastPhi > phi;
            wave = (withinPulse || wasInPulse)
                ? 2 * pseudoRandom(Math.floor(t * freq) + seed) - 1
                : 0;
            break;
        }
        case "impulse-ease": {
        // pulse index for consistent randomness
            const idx        = Math.floor(t * freq) + seed;
            const within     = phi < duty;
            const wrapped    = lastPhi < duty && lastPhi > phi;
            if (within || wrapped) {
                // compute local position in the pulse [0..1]
                const localPhi = within
                    ? phi / duty
                    : ((phi + 1) / duty) % 1; // handle wrap-around
                // cubic smoothstep
                const env = localPhi * localPhi * (3 - 2 * localPhi);
                // same random value for the whole pulse
                const rand = 2 * pseudoRandom(idx) - 1;
                wave = rand * env;
            } else {
                wave = 0;
            }
            break;
        }
        case "walk": {
            const dt = 1 / 30;
            if (mod._walkValue === undefined) {
                mod._walkValue = value;
            }
            const drift = (Math.random() * 2 - 1) * freq * dt;
            mod._walkValue += drift;
            // clamp
            mod._walkValue = Math.max(-1, Math.min(1, mod._walkValue));
            mod._lastUpdate = t;
            return offset + scale * mod._walkValue;
            // TODO, maybe: expose a wrap mode like:
            //  mod._walkValue = ((mod._walkValue + 1) % 2 + 2) % 2 - 1;
        }
        case "fm-lfo":
          const modulator = Math.sin(phi * 5 * Math.PI);
          const carrier  = Math.sin((phi * 4 * Math.PI) + modulator);
          wave = carrier;
          break;
        default:
            wave = 0;
    }

    return offset + scale * wave;
}

export const resolveAnimAll = (params, t) => valmap((p) => resolveAnim(p, t), params)

// TODO: fix this
export function clampAnimationParams(min, max, bias) {
    return [bias, max];
}
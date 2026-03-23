class RingBuffer {
  constructor(size, arraytype = Float32Array) {
    this.buffer = new arraytype(size);
    this.head = 0;
    this.size = size;
  }

  pushFront(val) {
    this.head = (this.head - 1 + this.size) % this.size;
    this.buffer[this.head] = val;
  }

  pushBack(val) {
    this.buffer[this.head] = val;
    this.head = (this.head + 1) % this.size;
  }

  readFront(val) {
    return this.buffer[this.head];
  }

  readBack(val) {
    return this.buffer[(this.head - 1 + this.size) % this.size];
  }

  insert(val, i) {
    this.buffer[(this.head + i) % this.size] = val;
  }

  get(i) {
    return this.buffer[(this.head + i) % this.size];
  }
}


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
  name: "FIR",

  defaultConfig: {
    nSamples: 5,
    nTaps: 1
  },

  apply(instance, data, width, height, t) {
    const { nSamples } = instance.config;
    const nTaps = Math.min(instance.config.nTaps, nSamples);
    const taps = [];
    const tapScl = nSamples / nTaps;
    for (let t = 0; t < nTaps; t++) {
      taps.push(nSamples - 1 - Math.floor(tapScl * t));
    }
    const copy = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y++) {
      const rowStart = y * width * 4;
      const rowEnd = rowStart + width * 4;
      const buffer = new RingBuffer(nSamples)
      for (let i = rowStart; i < rowEnd; i++) {
        buffer.pushFront(data[i]);
        const delays = taps.map((t) => buffer.get(t));
        copy[i] = delays.reduce((a, b) => a + b / nTaps, 0);
      }
    }
    return copy;
  },

  uiLayout: [
    { type: "range", key: "nTaps", label: "Taps", min: 1, max: 20, step: 1},
    { type: "range", key: "nSamples", label: "Samples", min: 2, max: 200, step: 1 }
  ]
};

export const effectMeta = {
  group: "Wandering",
  tags: ["cpu", "filter", "convolution", "kernel"],
  description: "Applies a general-purpose 2D FIR filter in data (_not pixel_) space."
  + "Slow and may produce unrenderable transparency conditions.",
  canAnimate: false,
  realtimeSafe: false,  // heavy CPU convolution
};
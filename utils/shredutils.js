export function histogram(array) {
    const counts = new Map();
    for (let i = 0; i < array.length; i++) {
        const val = array[i];
        counts.set(val, (counts.get(val) || 0) + 1);
    }
    return counts;
}

export function buildAliasTable(probabilities) {
    const n = probabilities.length;
    const scaled = probabilities.map(p => p * n);
    const alias = new Array(n);
    const prob = new Array(n);
    const small = [], large = [];

    scaled.forEach((p, i) => (p < 1 ? small : large).push(i));

    while (small.length && large.length) {
        const l = small.pop();
        const g = large.pop();
        prob[l] = scaled[l];
        alias[l] = g;
        scaled[g] = scaled[g] + scaled[l] - 1;
        (scaled[g] < 1 ? small : large).push(g);
    }

    for (let i = 0; i < n; i++) {
        prob[i] = prob[i] ?? 1;
        alias[i] = alias[i] ?? i;
    }

    return {prob, alias};
}

export function makeSampler(probabilities) {
    const {prob, alias} = buildAliasTable(probabilities)

    return function sampler(values) {
        const i = Math.floor(Math.random() * prob.length);
        return Math.random() < prob[i] ? values[i] : values[alias[i]];
    }
}

export function shred(array, valuesToReplace, counts = undefined) {
    if (counts === undefined) {
        counts = histogram(array);
    }
    const valueSet = new Set(valuesToReplace);
    const output = new Float32Array(array.length);

    // 2. Identify replacement pool
    const allValues = Array.from(counts.keys());
    const replacementPool = allValues.filter(v => !valueSet.has(v));

    const weights = replacementPool.map(v => counts.get(v));
    const total = weights.reduce((a, b) => a + b, 0);

    const sampler = makeSampler(weights.map(w => w / total));

    for (let i = 0; i < array.length; i++) {
        const val = array[i];
        const shouldReplace = valueSet.has(val);
        output[i] = shouldReplace ? sampler(replacementPool) : val;
    }

    return output;
}
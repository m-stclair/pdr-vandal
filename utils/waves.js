function saw(x) {
    return 2 * (x / (2 * Math.PI) - Math.floor(x / (2 * Math.PI) + 0.5));
}

function square(x) {
    return Math.sign(Math.sin(x));
}

function tri(x) {
    return 2 * Math.abs(saw(x)) - 1;
}

export default {saw, square, tri}
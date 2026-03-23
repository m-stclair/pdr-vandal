export default {
    bands(x, y, freq) {
        return (x + y) * Math.PI * freq;
    },
    checks(x, y, freq) {
        return Math.sin(x * freq * Math.PI) * Math.sin(y * freq * Math.PI);
    },
    rings(x, y, freq) {
        const dx = x - 0.5;
        const dy = y - 0.5;
        return Math.sin(Math.sqrt(dx * dx + dy * dy) * freq * Math.PI * 2);
    },
    radial(x, y, freq) {
        const dx = x - 0.5;
        const dy = y - 0.5;
        return Math.sqrt(dx * dx + dy * dy) * freq * Math.PI * 2;
    }
}

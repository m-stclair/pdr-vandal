export async function injectPartial(partialURL, target) {
    const res = await fetch(partialURL);
    target.innerHTML = await res.text();
}

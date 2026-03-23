function validateNoFeedback(inputTex, fboTex) {
    if (inputTex === fboTex) {
        console.error("💥 FEEDBACK LOOP DETECTED 💥", inputTex._debugLabel);
        throw new Error("Feedback loop: sampling from current render target.");
    }
}

// console.trace("drawArrays stack trace");
// for (const key of Object.keys(Object.getPrototypeOf(gl))) {
//     if (typeof gl[key] === 'function') {
//         const original = gl[key].bind(gl);
//         gl[key] = (...args) => {
//             console.log(`GL call: ${key}`, args);
//             return original(...args);
//         };
//     }
// }

function validateNoFeedbackOrDie(inputTex, outputTex) {
    if (inputTex === outputTex) {
        console.groupCollapsed("%c💀 FEEDBACK LOOP DETECTED 💀", "color: red; font-weight: bold;");
        console.trace("Execution path to GPU heresy:");
        console.log("Input texture:", inputTex?._debugLabel, inputTex);
        console.log("Output texture:", outputTex?._debugLabel, outputTex);
        console.groupEnd();

        // Dramatic pause before self-sabotage
        setTimeout(() => {
            let a = inputTex;
            let b = outputTex;
            document.body.innerHTML = `<pre style="color:red;font-size:2em;">The pipeline has violated sacred law. It must be stopped.</pre>`;
            throw new Error("⚠️ Feedback loop detected — execution halted");
        }, 100);
    }
}


export function monkeyPatchDrawArrays(gl) {

    const originalDrawArrays = gl.drawArrays.bind(gl);

    gl.drawArrays = function patchedDrawArrays(...args) {
        // console.log("🟡 drawArrays called", {
        //     args,
        //     currentProgram: gl.getParameter(gl.CURRENT_PROGRAM),
        //     boundFBO: gl.getParameter(gl.FRAMEBUFFER_BINDING),
        //     activeTexture: gl.getParameter(gl.ACTIVE_TEXTURE),
        //     texture0: gl.getParameter(gl.TEXTURE_BINDING_2D),
        // });

        // validateNoFeedbackOrDie(gl.ACTIVE_TEXTURE, gl.TEXTURE_BINDING_2D);

        const result = originalDrawArrays(...args);
        const err = gl.getError();
        if (err !== gl.NO_ERROR) {
            console.error("WebGL error after drawArrays:", err);
        }
        return result;

    };
}

export function monkeyPatchBindTexture(gl) {

    const originalBindTexture = gl.bindTexture.bind(gl);

    gl.bindTexture = function patchedBindTexture(...args) {

        // if (!gl.isTexture(args[1])) {
        //     throw new Error("not a texture")
        // }
        const res = originalBindTexture(...args);
        const err = gl.getError();
        if (err !== gl.NO_ERROR) {
            const tex = args[1];
            console.error("WebGL error after bindTexture:", err);
            console.log(`Texture belongs to ${tex._name}-${tex._id}`)
            console.trace("bindTexture stack trace");
        }
        return res;
    };
}
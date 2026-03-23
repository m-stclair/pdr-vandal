import {UniformSetters, checkTexture, checkFrameBuffer} from "./gl.js";
import {isEqual} from "./helpers.js";

export class webGLState {
    constructor(renderer, name, id) {
        this.renderer = renderer;
        this.fragSrc = null;
        this.initialized = false;
        this.name = name;
        this.id = id;
        this.includeMap = null;
        this.last_defines = {};
        this.last_uniforms = {};
    }

    get gl() {
        return this.renderer.gl;
    }

    get format() {
        return this.renderer.format;
    }

    get vao() {
        return this.renderer.vao;
    }

    getOrCreateLUT(name, data) {
        return this.renderer.getOrCreateLUT(name, data);
    }

    init(defines) {
        if (!this.fragSrc) {
            throw new Error(`${this.name}-${this.id} GL init called with unloaded frag source`)
        }
        if (this.fragSrc instanceof Promise || Object.values(this.includeMap).some((x) => x instanceof Promise)) {
            // We're going too fast! Soft fault.
            return false;
        }
        this.program = this.buildProgram(defines);
        this.uniforms = this.getUniformLocations(this.program);
        this.initialized = true;
        return true;
    }

    allocateTexture(format, width, height, buffer) {
        const {internalFormat, formatEnum, typeEnum, arrayConstructor} = this.renderer.format;
        const gl = this.gl;
        if (buffer && !(buffer instanceof arrayConstructor)) {
            throw new Error("Mismatched buffer type for texture format");
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, formatEnum, typeEnum, buffer);
        return buffer;
    }

    definesChanged(defines) {
        if (!defines) return false;
        if (!this.last_defines) return true;
        for (let k of Object.keys(defines)) {
            if (isEqual(defines[k], this.last_defines[k])) continue;
            if (defines[k] === this.last_defines[k]) continue;
            if (defines[k] instanceof Number && defines[k] === Number.parseInt(this.last_defines[k])) continue;
            return true;
        }
        return false;
    }

    buildProgram(defines) {
        const gl = this.gl;
        const fs = this.renderer.compile(
            gl.FRAGMENT_SHADER,
            this.fragSrc,
            {includeMap: this.includeMap, defines: defines}
        );
        const prog = gl.createProgram();
        gl.attachShader(prog, this.renderer.vertexShader);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(prog);
            throw new Error(`Could not compile WebGL program. \n\n${info}`);
        }
        this.last_defines = defines;
        return prog;
    }

    getUniformLocations(program) {
        const gl = this.gl;
        const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        const locations = {};
        for (let i = 0; i < count; i++) {
            const info = gl.getActiveUniform(program, i);
            locations[info.name] = gl.getUniformLocation(program, info.name);
        }
        return locations;
    }

    renderGL(inputTex, outputFBO, uniformSpec, defines) {
        const undef = (Object.entries(uniformSpec).filter(v => v[1].value === undefined))
        if (undef.length > 0) {
            console.warn(
                `some uniforms undefined in ${this.name}-${this.id}: ${undef.map(o => o)}`
            )
        }
        if (!this.initialized) {
            // this should always mean the frag source isn't ready yet --
            // machine gun preset loading or something. soft fault, skip a frame.
            if(!this.init(defines)) return inputTex;
        }
        const gl = this.gl;
        // this will result in a double compilation on the very first frame
        // in some cases, which is probably not a huge deal.
        if (this.definesChanged(defines)) {
            gl.deleteProgram(this.program);
            this.program = this.buildProgram(defines);
            this.uniforms = this.getUniformLocations(this.program);
        }
        gl.useProgram(this.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(this.uniforms["u_image"], 0);
        this.uploadUniforms(uniformSpec);
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO.fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,
            outputFBO.texture, 0
        );
        gl.viewport(0, 0, outputFBO.width, outputFBO.height);
        gl.bindVertexArray(this.renderer.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this.last_uniforms = uniformSpec;
    }
        // checkFrameBuffer(gl);
        // checkTexture(gl, inputTex);
        // checkTexture(gl, outputFBO.texture);

    uploadUniforms(uniformSpec) {
        const gl = this.gl;
        // Upload other uniforms
        Object.entries(uniformSpec).forEach(([name, {value, type, width, height, binding}]) => {
            if (!this.uniforms[name]) {
                // TODO: a hack. ACTIVE_UNIFORMS doesn't detect arrays well?
                this.uniforms[name] = gl.getUniformLocation(this.program, name);
            }
            const loc = this.uniforms[name];
            if (type === "texture2D") {
                // TODO: terrible to unconditionally pick texture1!
                gl.activeTexture(gl.TEXTURE1);
                if (value instanceof Array) {
                    const value = gl.createTexture()
                    this.allocateTexture(this.format, width, height, value);
                }
                gl.bindTexture(gl.TEXTURE_2D, value);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                UniformSetters[type](gl, loc, 1);
                return;
            }

            if (isEqual(this.last_uniforms[name], value)) return;
            if (type === "UBO") {
                const blockIndex = gl.getUniformBlockIndex(this.program, name);
                const blockBinding = binding ?? 0;
                gl.uniformBlockBinding(this.program, blockIndex, blockBinding);
                const ubo = gl.createBuffer();
                gl.bindBufferBase(gl.UNIFORM_BUFFER, blockBinding, ubo);
                gl.bufferData(gl.UNIFORM_BUFFER, value, gl.DYNAMIC_DRAW);
            } else {
                UniformSetters[type](gl, loc, value);
            }
            // const err = gl.getError();
            // if (err !== gl.NO_ERROR) {
            //     console.warn("Bad uniform set:", err, name);
            // }

        });
    }

}

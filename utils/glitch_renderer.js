// Hybrid GPU/CPU pipeline manager
import { checkFrameBuffer, checkTexture, preprocessGLSL} from "./gl.js";
import { getEffectStack, requestUIDraw } from "../state.js";
import { hashObject } from "./helpers.js";
import { isModulating } from "../glitch.js";
import { monkeyPatchBindTexture, monkeyPatchDrawArrays } from "../tools/gl_bs.js";
import { clamp } from "./mathutils.js";
import {
    AutoRegionEnum, computeAutoGains, DebayerMethodEnum, debayerFrag,
    debayerFragLoaded, planeOffset
} from "../effects/debayer.js";

// Debayer's initHook waits for this shader, so instances added through
// fx.ready never ingest the raw mosaic. Paths that skip fx.ready (e.g. the
// randomizer) can still render a frame before it arrives (lastDebayerKey ===
// null); request a render once it does so that frame is redone. Not awaited
// at top level: this module is part of an import cycle with state.js /
// glitch.js, where top-level await risks deadlock. The dynamic import settles
// only after state.js has finished evaluating, so requestRender is
// initialized even if the shader arrives while state.js is still loading.
debayerFragLoaded.then(
    () => import("../state.js").then(({requestRender}) => requestRender()),
    e => console.error("failed to load debayer shader", e),
);

function debayerGains(config) {
    return ["GAIN_R", "GAIN_G", "GAIN_B"].map(k => Number(config[k]?.value ?? config[k]));
}

const ingressVertSrc = `#version 300 es

in vec2 a_position;
out vec2 v_uv;
void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}`

const rgbaIngressFragSrc = `#version 300 es
precision mediump float;

uniform sampler2D u_source;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_center;
uniform vec2 u_viewSpan;

void main() {
    vec2 srcUV = clamp(u_center + (v_uv - 0.5) * u_viewSpan, 0.0, 1.0);
    outColor = texture(u_source, srcUV);
}`

const floatRGBIngressFragSrc = `#version 300 es
precision highp float;

uniform sampler2D u_source;
in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_center;
uniform vec2 u_viewSpan;

void main() {
    vec2 srcUV = clamp(u_center + (v_uv - 0.5) * u_viewSpan, 0.0, 1.0);
    outColor = vec4(texture(u_source, srcUV).rgb, 1.0);
}`;

const floatGrayIngressFragSrc = `#version 300 es
precision highp float;
uniform sampler2D u_source;
in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_center;
uniform vec2 u_viewSpan;

void main() {
    vec2 srcUV = clamp(u_center + (v_uv - 0.5) * u_viewSpan, 0.0, 1.0);
    float v = texture(u_source, srcUV).r;
    outColor = vec4(v, v, v, 1.0);
}`;

const outputFragSrc = `#version 300 es
    precision mediump float;
    
    uniform sampler2D u_image;
    // View coordinates (top-left origin) -> working-texture coordinates.
    uniform vec2 u_uvOffset;
    uniform vec2 u_uvScale;
    // 1 when drawing to the canvas, whose y axis points up.
    uniform bool u_flipY;

    in vec2 v_uv;
    out vec4 outColor;

    void main() {
        vec2 viewUV = vec2(v_uv.x, u_flipY ? 1.0 - v_uv.y : v_uv.y);
        outColor = texture(u_image, u_uvOffset + viewUV * u_uvScale);
    }`

const outputVertSrc = `#version 300 es
    in vec2 a_position;
    out vec2 v_uv;
    void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`


export class GlitchRenderer {
    constructor(ctx) {
        this.gl = ctx;
        // monkeyPatchDrawArrays(this.gl);
        // monkeyPatchBindTexture(this.gl);
        const version = this.gl.getParameter(this.gl.VERSION);
        console.log("WebGL version:", version);
        this.format = {
            internalFormat: this.gl.RGBA16F,
            formatEnum: this.gl.RGBA,
            typeEnum: this.gl.FLOAT,
            arrayConstructor: Float32Array,
        }
        this.fxbuffers = {};
        this.lutCache = new Map();
        // NOTE: I am _not_ sure why i need this. driver weirdness?
        if (!this.gl.getExtension("EXT_color_buffer_float")) {
            throw new Error("bad graphics weirdness");
        }
        this.vertexShader = null;
        this.initSharedResources();
        this.inputTexture = null;
        this.inputHeight = null;
        this.inputWidth = null;
        this.ingress = this.compileIngressPrograms();
        this.debayerIngress = new Map();
        this.lastDebayerKey = "null";
        // Debayer AUTO gains, per effect instance: the inputs they were
        // computed from and the values written ({key, source, gains}); plus a
        // hold so exports never recompute them.
        this.autoGainState = new WeakMap();
        this.freezeAutoGains = false;
        // Decorrelation Stretch: per-effect statistics cache, the export flag
        // that selects full-resolution statistics, and the view region held
        // while an export moves the view.
        this.dcsCache = new Map();
        this.dcsExport = false;
        this.frozenViewRegion = null;
        this.floatLinear = !!this.gl.getExtension("OES_texture_float_linear");
        this.renderCache = new Map();
        this.outputProg = null;
        this.source = null;
        this.defaultFBO = this.gl.createFramebuffer();
        this.locked = false;
        this.sourceTexture = null;
        this.zoom = 1.0
        this.centerX = 0.5
        this.centerY = 0.5
        this.f32_format = {
            internalFormat: this.gl.RGBA32F,
            formatEnum: this.gl.RGBA,
            typeEnum: this.gl.FLOAT
        }
    }

    lock() {
        this.locked = true;
    }

    unlock() {
        this.locked = false;
    }

    getSourceSize() {
        if (!this.source) return null;
        return [this.source.width, this.source.height];
    }

    // Dimensions of the image as ingested: half-size when Debayer is
    // extracting a single CFA plane, otherwise the raw source size.
    getImageSize() {
        const size = this.getSourceSize();
        if (!size) return null;
        if (this.getDebayerConfig()?.METHOD === DebayerMethodEnum.SUBSAMPLE) {
            return [Math.floor(size[0] / 2), Math.floor(size[1] / 2)];
        }
        return size;
    }

    // Map a pixel in getImageSize() coordinates to the raw source pixel it
    // was read from.
    imageToSourcePixel(x, y) {
        const cfg = this.getDebayerConfig();
        if (cfg?.METHOD === DebayerMethodEnum.SUBSAMPLE) {
            const [ox, oy] = planeOffset(cfg.PATTERN, cfg.PLANE);
            return [2 * x + ox, 2 * y + oy];
        }
        return [x, y];
    }

    clearSourceTextures() {
        if (this.sourceTexture) {
            this.gl.deleteTexture(this.sourceTexture);
            this.sourceTexture = null;
        }
        if (this.inputTexture) {
            this.gl.deleteTexture(this.inputTexture);
            this.inputTexture = null;
        }
        this.inputDirty = true;
    }

    setHTMLSource(img) {
        const width = img.naturalWidth ?? img.videoWidth ?? img.width;
        const height = img.naturalHeight ?? img.videoHeight ?? img.height;

        if (!width || !height) {
            throw new Error("setHTMLSource: source has invalid dimensions");
        }

        // Reuse a scratch canvas/context for readback.
        if (!this._readbackCanvas) {
            this._readbackCanvas =
                typeof OffscreenCanvas !== "undefined"
                    ? new OffscreenCanvas(width, height)
                    : document.createElement("canvas");
        }

        const canvas = this._readbackCanvas;
        canvas.width = width;
        canvas.height = height;

        if (!this._readbackCtx) {
            this._readbackCtx = canvas.getContext("2d", { willReadFrequently: true });
        }

        const ctx = this._readbackCtx;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);

        this.source = {
            kind: "rgba8",
            channels: 4,
            width,
            height,
            scale: 1,
            offset: 0,
            data: imageData.data,
        };

        this.clearSourceTextures();
    }


    setFloat32Source(f32Array, width, height, channels, scale, offset) {
        this.source = {
            kind: channels === 1 ? "r32f" : "rgb32f",
            channels: channels,
            width,
            height,
            scale,
            offset,
            data: f32Array,
        };
        this.clearSourceTextures();
    }


    initSharedResources() {
        this.vao = this.createFullscreenQuad(this.gl);
        this.compileVertexShader();
    }

    compileProgram(vertSrc, fragSrc) {
        const gl = this.gl;

        const vert = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vert, vertSrc);
        gl.compileShader(vert);
        if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(vert));
        }

        const frag = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(frag, fragSrc);
        gl.compileShader(frag);
        if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(frag));
        }

        const prog = gl.createProgram();
        gl.attachShader(prog, vert);
        gl.attachShader(prog, frag);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(prog));
        }

        return prog;
    }

    compileIngressPrograms() {
        const gl = this.gl;

        const rgbaProgram = this.compileProgram(ingressVertSrc, rgbaIngressFragSrc);
        const rgbaUniforms = {
            source: gl.getUniformLocation(rgbaProgram, "u_source"),
            viewSpan: gl.getUniformLocation(rgbaProgram, "u_viewSpan"),
            center: gl.getUniformLocation(rgbaProgram, "u_center"),
        };

        const f32RGBProgram = this.compileProgram(ingressVertSrc, floatRGBIngressFragSrc);
        const f32RGBUniforms = {
            source: gl.getUniformLocation(f32RGBProgram, "u_source"),
            viewSpan: gl.getUniformLocation(f32RGBProgram, "u_viewSpan"),
            center: gl.getUniformLocation(f32RGBProgram, "u_center"),
        };

        const f32GrayProgram = this.compileProgram(ingressVertSrc, floatGrayIngressFragSrc);
        const f32GrayUniforms = {
            source: gl.getUniformLocation(f32GrayProgram, "u_source"),
            viewSpan: gl.getUniformLocation(f32GrayProgram, "u_viewSpan"),
            center: gl.getUniformLocation(f32GrayProgram, "u_center"),
        };
        return {
            rgba8: { program: rgbaProgram, uniforms: rgbaUniforms },
            rgb32f: { program: f32RGBProgram, uniforms: f32RGBUniforms },
            r32f: { program: f32GrayProgram, uniforms: f32GrayUniforms }
        };
    }

    getDebayerEffect() {
        return getEffectStack().find(f => f.name === "Debayer" && !f.disabled);
    }

    getDebayerConfig() {
        const fx = this.getDebayerEffect();
        if (!fx) return null;
        const method = Number(fx.config.METHOD);
        const rgb = method !== DebayerMethodEnum.SUBSAMPLE && fx.config.RGB === true;
        return {
            PATTERN: Number(fx.config.PATTERN),
            METHOD: method,
            CHANNEL: Number(fx.config.CHANNEL),
            PLANE: Number(fx.config.PLANE),
            RGB: rgb ? 1 : 0,
            GAINS: rgb ? debayerGains(fx.config) : null,
        };
    }

    getDebayerIngress(cfg) {
        if (!debayerFrag.src) return null;
        const {GAINS, ...defines} = cfg;
        const key = `${cfg.PATTERN}-${cfg.METHOD}-${cfg.CHANNEL}-${cfg.PLANE}-${cfg.RGB}`;
        if (this.debayerIngress.has(key)) return this.debayerIngress.get(key);
        const gl = this.gl;
        const fragSrc = preprocessGLSL(debayerFrag.src, {defines});
        const program = this.compileProgram(ingressVertSrc, fragSrc);
        const entry = {
            program,
            uniforms: {
                source: gl.getUniformLocation(program, "u_source"),
                viewSpan: gl.getUniformLocation(program, "u_viewSpan"),
                center: gl.getUniformLocation(program, "u_center"),
                sourceSize: gl.getUniformLocation(program, "u_sourceSize"),
                gains: gl.getUniformLocation(program, "u_gains"),
            }
        };
        this.debayerIngress.set(key, entry);
        return entry;
    }

    // Debayer AUTO: when its inputs change, compute per-band gains and write
    // them into the effect config (and so the sliders). A gain the user has
    // changed since that instance's last auto write turns its AUTO off
    // instead. State is kept per instance, so switching which Debayer is
    // active (disable, delete, reorder) never compares one instance's gains
    // with another's.
    updateAutoGains() {
        if (this.freezeAutoGains) return;
        const fx = this.getDebayerEffect();
        const cfg = fx ? this.getDebayerConfig() : null;
        if (!cfg?.RGB || fx.config.AUTO !== true
            || this.source?.kind !== "r32f" || !this.source.data) {
            if (fx) this.autoGainState.delete(fx);
            return;
        }
        const saved = this.autoGainState.get(fx);
        if (saved && cfg.GAINS.some((g, i) => g !== saved.gains[i])) {
            fx.config.AUTO = false;
            this.autoGainState.delete(fx);
            requestUIDraw();
            return;
        }
        const {width, height} = this.source;
        let rect = {x0: 0, y0: 0, x1: width, y1: height};
        if (Number(fx.config.AUTO_REGION) === AutoRegionEnum.CURRENT_VIEW) {
            const {u0, u1, v0, v1} = this.getViewRegion();
            rect = {
                x0: Math.floor(u0 * width), x1: Math.ceil(u1 * width),
                y0: Math.floor(v0 * height), y1: Math.ceil(v1 * height),
            };
        }
        const key = JSON.stringify([cfg.PATTERN, rect]);
        if (saved && saved.key === key && saved.source === this.source) return;
        const gains = computeAutoGains(
            this.source.data, width, height, cfg.PATTERN, rect
        );
        [fx.config.GAIN_R, fx.config.GAIN_G, fx.config.GAIN_B] = gains;
        this.autoGainState.set(fx, {key, source: this.source, gains});
        requestUIDraw();
    }

    compile(type, source, ppOptions) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        const processed = preprocessGLSL(source, ppOptions);

        // console.log(processed);
        // console.log(ppOptions?.defines)
        gl.shaderSource(shader, processed);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    compileVertexShader() {
        this.vertexShader = this.compile(this.gl.VERTEX_SHADER,
            `#version 300 es
          in vec2 a_position;   
          out vec2 v_texCoord;
          void main() {
            v_texCoord = 0.5 * (a_position + 1.0);
            gl_Position = vec4(a_position, 0, 1);
          }
        `);
    }


    createFullscreenQuad(gl) {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const verts = new Float32Array([
            -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1,
            -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1
        ]);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
        return vao;
    }

    getOrCreateLUT(name, data) {
        if (this.lutCache.has(name)) return this.lutCache.get(name);
        const tex = this.createLUTTexture(data);
        this.lutCache.set(name, tex);
        return tex;
    }

    createLUTTexture(data) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // checkTexture(gl, tex);
        return tex;
    }

    ensureInputTexture(f32Array, width, height) {
        const gl = this.gl;
        const tex = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            this.format.internalFormat,
            width,
            height,
            0,
            this.format.formatEnum,
            this.format.typeEnum,
            f32Array
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // checkTexture(gl, tex);
        return tex;
    }

    f32ToTex(f32Array, width, height) {
        return this.ensureInputTexture(f32Array, width, height);
    }

    getEffectFBO(id, width, height, name, format = null) {
        if (!this.fxbuffers[id]) {
            this.fxbuffers[id] = this.make_framebuffer(width, height, id, name, format);
        }
        return this.fxbuffers[id];
    }

    deleteEffectFBO(id) {
        if (!this.fxbuffers[id]) return;
        const fbo = this.fxbuffers[id];
        this.deleteFrameBuffer(fbo.fbo);
        this.gl.deleteTexture(fbo.texture);
        this.fxbuffers[id] = undefined;
    }

    // RGBA32F is only filterable with OES_texture_float_linear; without it a
    // LINEAR float texture is incomplete and samples as black.
    textureFilter(internalFormat) {
        const gl = this.gl;
        return internalFormat === gl.RGBA32F && !this.floatLinear ? gl.NEAREST : gl.LINEAR;
    }

    make_framebuffer(width, height, id, name, format = null) {
        const gl = this.gl;
        const fmt = format ?? this.format;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            fmt.internalFormat,
            width,
            height,
            0,
            fmt.formatEnum,
            fmt.typeEnum,
            null
        );
        const filter = this.textureFilter(fmt.internalFormat);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // checkTexture(gl, tex);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                gl.TEXTURE_2D, tex, 0);
        // checkFrameBuffer(gl);
        tex._id = id;
        tex._name = name;
        fbo._id = id;
        fbo._name = name;
        return {fbo, texture: tex, width, height};

    }

    readFramebufferToPixels(tex, width, height) {
        const gl = this.gl;
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        // checkTexture(gl, tex);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D, tex, 0);
        const pixels = new this.format.arrayConstructor(width * height * 4);
        gl.readPixels(0, 0, width, height, this.format.formatEnum,
                      this.format.typeEnum, pixels);
        this.deleteFrameBuffer(fbo);
        return pixels;
    }

    deleteFrameBuffer(fbo) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.defaultFBO);
        gl.deleteFramebuffer(fbo);
    }

    unbindFramebuffer(fbo) {
        const gl = this.gl;
        if (gl.getParameter(gl.FRAMEBUFFER_BINDING) === fbo) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.defaultFBO);
        }
    }

    clearEffectBuffers() {
        Array.from(Object.keys(this.fxbuffers)).forEach(
            (id) => this.deleteEffectFBO(id)
        );
    }

    // Gains are frozen so the export uses exactly the displayed values, even
    // when AUTO tracks the current view and the full-image pass moves it.
    // Decorrelation Stretch recomputes its statistics at full resolution,
    // over the region that was on screen.
    async createExport(t, fullImage) {
        this.dcsExport = true;
        try {
            return this.withFrozenView(() => this.renderExport(t, fullImage));
        } finally {
            this.dcsExport = false;
        }
    }

    // Run fn, which may render something other than the on-screen view,
    // with view-dependent state held: Debayer AUTO gains don't recompute,
    // and statistics that track the current view keep using the region on
    // screen. Re-entrant.
    withFrozenView(fn) {
        const saved = [this.freezeAutoGains, this.frozenViewRegion];
        this.frozenViewRegion = this.getViewRegion();
        this.freezeAutoGains = true;
        try {
            return fn();
        } finally {
            [this.freezeAutoGains, this.frozenViewRegion] = saved;
        }
    }

    // A point sample of the whole image as displayed at fit-to-window: the
    // stack is rendered offscreen at zoom 1, then the view is restored (and
    // re-ingested on the next render). Null without a source.
    sampleWholeImage(t, maxSide = 256) {
        const saved = [this.zoom, this.centerX, this.centerY];
        return this.withFrozenView(() => {
            try {
                [this.zoom, this.centerX, this.centerY] = [1.0, 0.5, 0.5];
                this.inputDirty = true;
                const tex = this.applyEffects(t);
                return tex ? this.sampleView(tex, maxSide) : null;
            } finally {
                [this.zoom, this.centerX, this.centerY] = saved;
                this.inputDirty = true;
            }
        });
    }

    renderExport(t, fullImage) {
        const gl = this.gl;
        if (!fullImage) {
            this.loadImage();
            return this.readViewPixels(this.applyEffects(t));
        }
        const oldZoom = this.zoom;
        const oldPan = [this.centerX, this.centerY];
        this.zoom = 1.0;
        this.centerX = 0.5;
        this.centerY = 0.5;
        const iw = this.inputWidth
        const ih = this.inputHeight;
        const [w, h] = this.getImageSize();
        this.inputWidth = w;
        this.inputHeight = h;
        this.gl.canvas.width = w;
        this.gl.canvas.height = h;
        // The working region is now the whole image at native resolution.
        this.loadImage();
        const tex = this.applyEffects(t);
        const pixels = this.readFramebufferToPixels(tex, gl.canvas.width, gl.canvas.height);
        [this.inputWidth, this.inputHeight] = [iw, ih];
        this.inputDirty = true;
        this.gl.canvas.width = iw;
        this.gl.canvas.height = ih;
        if (fullImage) {
            this.zoom = oldZoom;
            this.centerX = oldPan[0];
            this.centerY = oldPan[1];
        }
        return {pixels, w, h};
    }


    applyEffects(t) {
        this.updateAutoGains();
        if (JSON.stringify(this.getDebayerConfig()) !== this.lastDebayerKey) {
            this.inputDirty = true;
        }
        if (this.source && JSON.stringify(this.getWorkingRegion()) !== this.lastRegionKey) {
            this.inputDirty = true;
        }
        if (this.inputDirty) {
            if (!this.source) return;
            const success = this.loadImage();
            if (!success) {
                console.error("failed to initialize input texture");
                return;
            }
            this.inputDirty = false;
        }
        if (this.locked) return;
        const effects = getEffectStack();
        const anySolo = getEffectStack().some(fx => fx.solo);

        const width = this.inputWidth;
        const height = this.inputHeight;
        let hashChain = `top`;
        let animationUpdate = false;
        let lastCacheEntry = {
            data: null,
            texture: this.inputTexture
        };
        for (const fx of effects) {
            if (!fx.apply) continue;
            if (fx.disabled || (anySolo && !fx.solo)) {
                hashChain += `${fx.name}-${fx.id}-disabled`;
                continue;
            }
            const cacheEntry = this.renderCache.get(fx.id);
            const isGPU = fx.isGPU;
            const timeChanged = cacheEntry?.lastT !== t;
            animationUpdate = animationUpdate ? animationUpdate : isModulating(fx) && timeChanged;
            const configHash = hashObject(fx.config);
            hashChain += configHash + fx.id;
            if (isModulating(fx)) hashChain += `-${t}`;
            const hashChanged = (
                !cacheEntry
                || hashChain !== cacheEntry.hashChain
            );
            let needsUpdate = (
                (hashChanged || animationUpdate)
                || (!cacheEntry?.texture && !cacheEntry?.data)
            );
            let update = {};
            if (needsUpdate) {
                let input;
                if (isGPU && lastCacheEntry?.texture) {
                    input = lastCacheEntry.texture;
                } else if (isGPU && lastCacheEntry?.data) {
                    lastCacheEntry.texture = this.f32ToTex(
                        lastCacheEntry.data, width, height
                    );
                    input = lastCacheEntry.texture;
                } else if (!isGPU && lastCacheEntry?.data) {
                    input = lastCacheEntry.data;
                } else if (!isGPU && lastCacheEntry?.texture) {
                    lastCacheEntry.data = this.readFramebufferToPixels(
                        lastCacheEntry.texture, width, height
                    )
                    input = lastCacheEntry.data;
                } else {
                    throw new Error("invalid effect cache state");
                }
                if (!isGPU) {
                    update['data'] = fx.apply(fx, input, width, height, t);
                } else {
                    if (fx.glState.renderer !== this) {
                        throw new Error("GL effect not attached to this renderer")
                    }
                    const fmt = fx.requires_f32 ? this.f32_format : null;
                    const fbo = this.getEffectFBO(fx.id, width, height, fx.name, fmt);
                    if (fx.glState) {
                        fx.glState.uniformsDirty = !(configHash === this.renderCache.get(fx.id)?.configHash);
                    }
                    fx.apply(fx, input, width, height, t, fbo);
                    update['texture'] = fbo.texture;
                }
            } else {
                update = {data: cacheEntry.data, texture: cacheEntry.texture}
            }
            lastCacheEntry = {
                configHash: configHash,
                disabled: fx.disabled,
                hashChain: hashChain,
                lastT: t,
            }
            lastCacheEntry['texture'] = update['texture'];
            lastCacheEntry['data'] = update['data']
            this.renderCache.set(fx.id, lastCacheEntry);
        }
        if (!lastCacheEntry.texture) {
            return this.f32ToTex(lastCacheEntry.data, width, height);
        }
        return lastCacheEntry.texture;
    }

    reset_pipeline() {
        this.renderCache.clear();
        this.clearEffectBuffers();
        getEffectStack().forEach((fx) => {
            if (!fx.glState) return;
            fx.glState.last_uniforms = {};
        });
    }

    buildSourceTexture() {
        if (!this.source) return false;

        const gl = this.gl;
        if (this.sourceTexture) {
            gl.deleteTexture(this.sourceTexture);
            this.sourceTexture = null;
        }

        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);

        // Reset all unpack state
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

        if (gl instanceof WebGL2RenderingContext) {
            gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
            gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
            gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
            gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, 0);
            gl.pixelStorei(gl.UNPACK_SKIP_IMAGES, 0);
        }

        if (this.source.kind === "r32f") {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F,
                          this.source.width, this.source.height, 0,
                          gl.RED, gl.FLOAT, this.source.data);
        } else if (this.source.kind === "rgb32f") {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F,
                          this.source.width, this.source.height, 0,
                          gl.RGB, gl.FLOAT, this.source.data);
        } else if (this.source.kind === "rgba8") {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                          this.source.width, this.source.height, 0,
                          gl.RGBA, gl.UNSIGNED_BYTE, this.source.data
        );

        } else {
            throw new Error(`Unrecognized source kind ${this.source.kind}`)
        }


        const filter = this.floatLinear ? gl.LINEAR : gl.NEAREST;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindTexture(gl.TEXTURE_2D, null);

        this.sourceTexture = tex;
        return true;
    }

    getViewRect() {
        const canvasW = this.gl.canvas.width;
        const canvasH = this.gl.canvas.height;
        const [imageW, imageH] = this.getImageSize();

        if (imageH === undefined) {
            throw new Error("oops")
        }
        const imageAspect = imageW / imageH;
        const canvasAspect = canvasW / canvasH;

        let fitW, fitH;

        if (canvasAspect > imageAspect) {
            fitH = canvasH;
            fitW = Math.round(fitH * imageAspect);

            const w = Math.min(canvasW, Math.round(fitW * this.zoom));
            const h = fitH;
            const x = Math.floor((canvasW - w) / 2);
            const y = 0;
            return { x, y, w, h };
        } else {
            fitW = canvasW;
            fitH = Math.round(fitW / imageAspect);

            const w = fitW;
            const h = Math.min(canvasH, Math.round(fitH * this.zoom));
            const x = 0;
            const y = Math.floor((canvasH - h) / 2);
            return { x, y, w, h };
        }
    }

    getViewSpan(viewW, viewH) {
        const [imageW, imageH] = this.getImageSize();

        const viewAspect = viewW / viewH;
        const imageAspect = imageW / imageH;

        const base = 1 / this.zoom;

        let spanX, spanY;

        if (viewAspect > imageAspect) {
            spanY = base;
            spanX = base * (viewAspect / imageAspect);
        } else {
            spanX = base;
            spanY = base * (imageAspect / viewAspect);
        }

        return [Math.min(spanX, 1), Math.min(spanY, 1)];
    }

    loadImage() {
        if (!this.source) {
            return false;
        }
        this.reset_pipeline();

        const gl = this.gl;
        const region = this.getWorkingRegion();
        const {w, h} = region;

        if (!this.sourceTexture) {
            const ok = this.buildSourceTexture();
            if (!ok) return false;
        }

        const ingress = this.getIngress();
        const {debayerCfg, debayer} = ingress;
        // null key while the shader is still loading forces a retry next frame
        this.lastDebayerKey = (!debayerCfg || debayer) ? JSON.stringify(debayerCfg) : null;

        const workingTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, workingTex);
        // Float32 so precision-sensitive effects (Input Stretch, Decorrelation
        // Stretch) see source values without half-float rounding.
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA32F,
            w,
            h,
            0,
            gl.RGBA,
            gl.FLOAT,
            null
        );
        const filter = this.textureFilter(gl.RGBA32F);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            workingTex,
            0
        );

        const draw = () => this.drawIngress(
            ingress, w, h,
            [(region.u0 + region.u1) / 2, (region.v0 + region.v1) / 2],
            [region.u1 - region.u0, region.v1 - region.v0],
        );
        // On the native grid, point-sample: ingested values are then exact
        // (linear filtering at texel centers can still blend in a little of
        // the neighbors on some GPUs).
        if (region.native) this.withNearestSource(draw);
        else draw();

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.defaultFBO);
        gl.deleteFramebuffer(fbo);

        if (this.inputTexture !== null) {
            gl.deleteTexture(this.inputTexture);
        }

        this.inputTexture = workingTex;
        this.inputWidth = w;
        this.inputHeight = h;
        this.workingRegion = region;
        this.lastRegionKey = JSON.stringify(region);
        return true;
    }

    // Ingress program for the current source: the Debayer program when a
    // Debayer effect is active and its shader has loaded, else the plain
    // program for the source kind.
    getIngress() {
        const debayerCfg = this.getDebayerConfig();
        const debayer = debayerCfg ? this.getDebayerIngress(debayerCfg) : null;
        const entry = debayer ?? this.ingress[this.source.kind];
        if (!entry?.program) {
            throw new Error(`Unknown source kind: ${this.source.kind}`);
        }
        return {debayerCfg, debayer, entry};
    }

    // Draw the source uv window center ± span/2 through the ingress into the
    // bound framebuffer's [0, w) x [0, h) viewport.
    drawIngress({debayerCfg, debayer, entry}, w, h, center, span) {
        const gl = this.gl;
        const {program, uniforms} = entry;
        gl.viewport(0, 0, w, h);
        gl.bindVertexArray(this.vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
        gl.useProgram(program);
        gl.uniform1i(uniforms.source, 0);
        gl.uniform2f(uniforms.viewSpan, span[0], span[1]);
        gl.uniform2f(uniforms.center, center[0], center[1]);
        if (debayer) {
            gl.uniform2i(uniforms.sourceSize, this.source.width, this.source.height);
            if (debayerCfg.GAINS) gl.uniform3f(uniforms.gains, ...debayerCfg.GAINS);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // Number of distinct bands the ingress produces: 3 for a Debayer RGB
    // composite or a browser image, 1 for any other Debayer output, else the
    // float source's channel count.
    ingressBandCount() {
        if (!this.source) return 0;
        const debayerCfg = this.getDebayerConfig();
        if (debayerCfg) return debayerCfg.RGB ? 3 : 1;
        if (this.source.kind === "rgba8") return 3;
        return this.source.channels;
    }

    // Source uv rect on screen, clamped to the image. Held at its pre-export
    // value while an export moves the view.
    getViewRegion() {
        return this.frozenViewRegion ?? this.visibleRegion();
    }

    // Source uv rect on screen now, clamped to the image.
    visibleRegion() {
        const {w, h} = this.getViewRect();
        const [spanX, spanY] = this.getViewSpan(w, h);
        return {
            u0: clamp(this.centerX - spanX / 2, 0, 1),
            u1: clamp(this.centerX + spanX / 2, 0, 1),
            v0: clamp(this.centerY - spanY / 2, 0, 1),
            v1: clamp(this.centerY + spanY / 2, 0, 1),
        };
    }

    makeF32Target(width, height) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0,
                      gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                gl.TEXTURE_2D, texture, 0);
        return {fbo, texture, width, height};
    }

    deleteF32Target(target) {
        this.deleteFrameBuffer(target.fbo);
        this.gl.deleteTexture(target.texture);
    }

    // Read the [0, w) x [0, h) corner of an RGBA32F target into out.
    readF32Target(target, w, h, out = new Float32Array(w * h * 4)) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, out);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.defaultFBO);
        return out;
    }

    // Ingress for statistics: like the view ingress, but null until the
    // Debayer shader (if any) has loaded, so stats never see the raw mosaic.
    getStatsIngress() {
        if (!this.source) return null;
        if (!this.sourceTexture && !this.buildSourceTexture()) return null;
        const ingress = this.getIngress();
        if (ingress.debayerCfg && !ingress.debayer) return null;
        return ingress;
    }

    // Run fn with the source texture point-sampled, so ingress pixels are
    // exact source values and NaNs don't bleed into their neighbors.
    withNearestSource(fn) {
        const gl = this.gl;
        const setFilter = filter => {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.bindTexture(gl.TEXTURE_2D, null);
        };
        setFilter(gl.NEAREST);
        try {
            return fn();
        } finally {
            setFilter(this.floatLinear ? gl.LINEAR : gl.NEAREST);
        }
    }

    // The Input Stretch instance when applyEffects would run it (not
    // disabled, not skipped by solo); statistics passes apply it so they see
    // the same values the effects downstream of it receive.
    getStatsStretchStage() {
        const stack = getEffectStack();
        const anySolo = stack.some(fx => fx.solo);
        const fx = stack.find(f => f.name === "Input Stretch");
        if (!fx?.apply || fx.disabled || (anySolo && !fx.solo)) return null;
        return fx;
    }

    // Draw the ingress window center ± span/2 into an exact-size w x h
    // RGBA32F target, then apply the Input Stretch stage (if any) into a
    // second one. Exact sizes matter: effect passes take their viewport and
    // u_resolution from the target. Targets are cached in `targets` by size.
    // Returns the target holding the result.
    renderStatsTile(ingress, stage, targets, w, h, center, span) {
        const get = key => {
            const k = `${key}:${w}x${h}`;
            if (!targets.has(k)) targets.set(k, this.makeF32Target(w, h));
            return targets.get(k);
        };
        const raw = get("ingress");
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, raw.fbo);
        this.withNearestSource(() => this.drawIngress(ingress, w, h, center, span));
        if (!stage) return raw;
        const stretched = get("stretched");
        stage.apply(stage, raw.texture, w, h, 0, stretched);
        return stretched;
    }

    // Point-sample a uv region on a res x res grid, after Input Stretch.
    // Returns interleaved RGBA, or null while the ingress isn't ready.
    sampleIngress(region, res) {
        const ingress = this.getStatsIngress();
        if (!ingress) return null;
        const targets = new Map();
        try {
            const out = this.renderStatsTile(
                ingress, this.getStatsStretchStage(), targets, res, res,
                [(region.u0 + region.u1) / 2, (region.v0 + region.v1) / 2],
                [region.u1 - region.u0, region.v1 - region.v0],
            );
            return this.readF32Target(out, res, res);
        } finally {
            targets.forEach(t => this.deleteF32Target(t));
        }
    }

    // Render a uv region at native resolution (one pixel per getImageSize()
    // pixel), after Input Stretch, in tiles of at most tileSize², calling
    // fn(target, w, h) for each. Returns false while the ingress isn't ready.
    forEachIngressTile(region, tileSize, fn) {
        const ingress = this.getStatsIngress();
        if (!ingress) return false;
        const stage = this.getStatsStretchStage();
        const [W, H] = this.getImageSize();
        const x0 = Math.floor(region.u0 * W), x1 = Math.max(x0 + 1, Math.ceil(region.u1 * W));
        const y0 = Math.floor(region.v0 * H), y1 = Math.max(y0 + 1, Math.ceil(region.v1 * H));
        const targets = new Map();
        try {
            for (let ty = y0; ty < y1; ty += tileSize) {
                for (let tx = x0; tx < x1; tx += tileSize) {
                    const w = Math.min(tileSize, x1 - tx);
                    const h = Math.min(tileSize, y1 - ty);
                    // Fragment i samples (tx + i + 0.5) / W: a texel center.
                    const out = this.renderStatsTile(
                        ingress, stage, targets, w, h,
                        [(tx + w / 2) / W, (ty + h / 2) / H], [w / W, h / H],
                    );
                    fn(out, w, h);
                }
            }
        } finally {
            targets.forEach(t => this.deleteF32Target(t));
        }
        return true;
    }

    // Draw the visible part of a working-resolution texture into the bound
    // framebuffer's current viewport, interpolated as on screen or, with
    // pointSample, taking each output pixel from the nearest working texel.
    drawView(tex, flipY, pointSample = false) {
        const gl = this.gl;
        if (this.outputProg === null) {
            this.outputProg = this.compileProgram(outputVertSrc, outputFragSrc);
        }
        const r = this.workingRegion;
        const vis = this.visibleRegion();
        const rw = r.u1 - r.u0, rh = r.v1 - r.v0;
        gl.useProgram(this.outputProg);
        gl.bindVertexArray(this.vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        const filter = this.floatLinear && !pointSample ? gl.LINEAR : gl.NEAREST;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        const loc = name => gl.getUniformLocation(this.outputProg, name);
        gl.uniform1i(loc('u_image'), 0);
        gl.uniform2f(loc('u_uvOffset'), (vis.u0 - r.u0) / rw, (vis.v0 - r.v0) / rh);
        gl.uniform2f(loc('u_uvScale'), (vis.u1 - vis.u0) / rw, (vis.v1 - vis.v0) / rh);
        gl.uniform1i(loc('u_flipY'), flipY ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    writeToCanvas(tex) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        const viewRect = this.getViewRect();
        gl.viewport(viewRect.x, viewRect.y, viewRect.w, viewRect.h);
        this.drawView(tex, true);
    }

    // What the canvas shows, at view resolution: float RGBA, row 0 at the
    // top of the view.
    readViewPixels(tex) {
        const {w, h} = this.getViewRect();
        return this.renderView(tex, w, h, false);
    }

    // A uniform point sample of the displayed view, at most maxSide pixels
    // on its long side. Point sampling keeps sampled values real (no
    // blending of neighbors, no NaN spread): zoomed out each sample is one
    // displayed pixel; zoomed in, one visible image pixel.
    sampleView(tex, maxSide = 256) {
        const {w, h} = this.getViewRect();
        const k = Math.min(1, maxSide / Math.max(w, h));
        return this.renderView(
            tex, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), true
        );
    }

    renderView(tex, w, h, pointSample) {
        const target = this.makeF32Target(w, h);
        try {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.fbo);
            this.gl.viewport(0, 0, w, h);
            this.drawView(tex, false, pointSample);
            return {pixels: this.readF32Target(target, w, h), w, h};
        } finally {
            this.deleteF32Target(target);
        }
    }

    clampCenter() {
        const viewRect = this.getViewRect();
        const [spanX, spanY] = this.getViewSpan(viewRect.w, viewRect.h);

        const halfW = 0.5 * spanX;
        const halfH = 0.5 * spanY;

        this.centerX = clamp(this.centerX, halfW, 1.0 - halfW);
        this.centerY = clamp(this.centerY, halfH, 1.0 - halfH);
    }

    // Texture-coordinate step of one image pixel in an effect pass over the
    // current view: neighborhood effects step by this so their kernels are
    // sized in image pixels at any zoom, matching a full-image export, where
    // it is exactly one texel. (Unregistered neighborhood effects should use
    // it too if re-enabled.)
    imagePixelStep() {
        const [imageW, imageH] = this.getImageSize();
        const r = this.workingRegion;
        return [1 / ((r.u1 - r.u0) * imageW), 1 / ((r.v1 - r.v0) * imageH)];
    }

    // How far beyond the visible region, in image pixels, the enabled
    // effects read: the sum of their neighborhoods, since stacked kernels
    // reach that far together.
    getStackMargin() {
        const stack = getEffectStack();
        const anySolo = stack.some(fx => fx.solo);
        let margin = 0;
        for (const fx of stack) {
            if (!fx.neighborhood || fx.disabled || (anySolo && !fx.solo)) continue;
            margin += Math.max(0, Math.ceil(Number(fx.neighborhood(fx.config)) || 0));
        }
        return margin;
    }

    // The grid effects run on: the visible region plus the stack's margin,
    // clamped to the image, so kernels see real image data at the view edges
    // and clamp at the image edges just as in a full-image export. Zoomed in
    // (an image pixel covers at least one display pixel) it is the native
    // image pixels, aligned and exact; zoomed out it is display resolution.
    // Returns the region in source uv, its size in texels, and whether it
    // is native.
    getWorkingRegion() {
        const [W, H] = this.getImageSize();
        const view = this.getViewRect();
        const [spanX, spanY] = this.getViewSpan(view.w, view.h);
        const vis = this.visibleRegion();
        const margin = this.getStackMargin();
        if (view.w / (spanX * W) >= 1) {
            const x0 = Math.max(0, Math.floor(vis.u0 * W) - margin);
            const x1 = Math.min(W, Math.ceil(vis.u1 * W) + margin);
            const y0 = Math.max(0, Math.floor(vis.v0 * H) - margin);
            const y1 = Math.min(H, Math.ceil(vis.v1 * H) + margin);
            return {u0: x0 / W, u1: x1 / W, v0: y0 / H, v1: y1 / H,
                    w: x1 - x0, h: y1 - y0, native: true};
        }
        const u0 = Math.max(0, vis.u0 - margin / W), u1 = Math.min(1, vis.u1 + margin / W);
        const v0 = Math.max(0, vis.v0 - margin / H), v1 = Math.min(1, vis.v1 + margin / H);
        return {u0, u1, v0, v1,
                w: Math.max(1, Math.round(view.w * (u1 - u0) / spanX)),
                h: Math.max(1, Math.round(view.h * (v1 - v0) / spanY)),
                native: false};
    }

    // Source uv (0-1, top-left origin) under a client-space point, unclamped,
    // and whether the point is over the displayed image rather than the
    // letterbox. The output pass flips Y, so top-left screen coordinates map
    // directly onto the uv convention used by ingress sampling.
    clientToSourceUV(clientX, clientY) {
        const canvas = this.gl.canvas;
        const rect = canvas.getBoundingClientRect();
        // Client -> drawing buffer pixels, top-left origin.
        const px = (clientX - rect.left) * (canvas.width / rect.width);
        const py = (clientY - rect.top) * (canvas.height / rect.height);
        const viewRect = this.getViewRect();
        const u = (px - viewRect.x) / viewRect.w;
        const v = (py - viewRect.y) / viewRect.h;
        const [spanX, spanY] = this.getViewSpan(viewRect.w, viewRect.h);
        return {
            srcU: this.centerX + (u - 0.5) * spanX,
            srcV: this.centerY + (v - 0.5) * spanY,
            inImage: u >= 0 && u < 1 && v >= 0 && v < 1,
        };
    }

    // Zoom by a wheel delta, about the client-space point (clientX, clientY)
    // when it is over the image, else about the view center.
    setZoom(deltaY, clientX, clientY) {
        const anchor = clientX === undefined ? null : this.clientToSourceUV(clientX, clientY);
        const factor = Math.exp(-deltaY * 0.001);
        this.zoom = Math.max(1.0, Math.min(this.zoom * factor, 32.0));
        if (anchor?.inImage) {
            // At a fixed zoom the point under the cursor is the view center
            // plus a constant offset, so shifting the center by how far that
            // point moved keeps it under the cursor.
            const moved = this.clientToSourceUV(clientX, clientY);
            this.centerX += anchor.srcU - moved.srcU;
            this.centerY += anchor.srcV - moved.srcV;
        }
        this.clampCenter();
        this.inputDirty = true;
    }

    panByPixels(dx, dy) {
        const rect = this.gl.canvas.getBoundingClientRect();

        const viewRect = this.getViewRect();
        const [spanX, spanY] = this.getViewSpan(viewRect.w, viewRect.h);

        this.centerX -= (dx / rect.width) * spanX;
        this.centerY += (dy / rect.height) * spanY;

        this.clampCenter();

        this.inputDirty = true;
    }

}

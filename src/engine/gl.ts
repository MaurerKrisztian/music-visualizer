// Minimal WebGL2 helpers: programs with cached uniforms, render targets and a
// fullscreen triangle.

export type GL = WebGL2RenderingContext;

export const FULLSCREEN_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export class Program {
    readonly program: WebGLProgram;
    private readonly locations = new Map<string, WebGLUniformLocation | null>();
    private textureUnit = 0;

    constructor(private readonly gl: GL, vs: string, fs: string, name = 'program') {
        const v = compile(gl, gl.VERTEX_SHADER, vs, name);
        const f = compile(gl, gl.FRAGMENT_SHADER, fs, name);
        const p = gl.createProgram()!;
        gl.attachShader(p, v);
        gl.attachShader(p, f);
        gl.linkProgram(p);
        gl.deleteShader(v);
        gl.deleteShader(f);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(p);
            gl.deleteProgram(p);
            throw new Error(`[${name}] link failed: ${log}`);
        }
        this.program = p;
    }

    use(): this {
        this.gl.useProgram(this.program);
        this.textureUnit = 0;
        return this;
    }

    loc(name: string): WebGLUniformLocation | null {
        let l = this.locations.get(name);
        if (l === undefined) {
            l = this.gl.getUniformLocation(this.program, name);
            this.locations.set(name, l);
        }
        return l;
    }

    f(name: string, v: number): this {
        const l = this.loc(name);
        if (l) this.gl.uniform1f(l, v);
        return this;
    }

    i(name: string, v: number): this {
        const l = this.loc(name);
        if (l) this.gl.uniform1i(l, v);
        return this;
    }

    v2(name: string, x: number, y: number): this {
        const l = this.loc(name);
        if (l) this.gl.uniform2f(l, x, y);
        return this;
    }

    v3(name: string, v: ArrayLike<number>): this {
        const l = this.loc(name);
        if (l) this.gl.uniform3f(l, v[0], v[1], v[2]);
        return this;
    }

    v4(name: string, x: number, y: number, z: number, w: number): this {
        const l = this.loc(name);
        if (l) this.gl.uniform4f(l, x, y, z, w);
        return this;
    }

    v4arr(name: string, data: Float32Array): this {
        const l = this.loc(name);
        if (l) this.gl.uniform4fv(l, data);
        return this;
    }

    tex(name: string, texture: WebGLTexture | null): this {
        const l = this.loc(name);
        if (!l) return this;
        const unit = this.textureUnit++;
        this.gl.activeTexture(this.gl.TEXTURE0 + unit);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.uniform1i(l, unit);
        return this;
    }

    dispose(): void {
        this.gl.deleteProgram(this.program);
    }
}

function compile(gl: GL, type: number, src: string, name: string): WebGLShader {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s) ?? '';
        const lines = src.split('\n');
        const m = /ERROR: \d+:(\d+)/.exec(log);
        const ln = m ? parseInt(m[1], 10) : -1;
        const ctx = ln > 0 ? lines.slice(Math.max(0, ln - 3), ln + 2).join('\n') : '';
        gl.deleteShader(s);
        throw new Error(`[${name}] ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader: ${log}\n${ctx}`);
    }
    return s;
}

export interface TargetFormat {
    internal: number;
    format: number;
    type: number;
}

export class RenderTarget {
    texture: WebGLTexture;
    fbo: WebGLFramebuffer;
    width = 0;
    height = 0;

    constructor(private readonly gl: GL, private readonly fmt: TargetFormat, w: number, h: number) {
        this.texture = gl.createTexture()!;
        this.fbo = gl.createFramebuffer()!;
        this.resize(w, h);
    }

    resize(w: number, h: number): void {
        w = Math.max(1, Math.round(w));
        h = Math.max(1, Math.round(h));
        if (w === this.width && h === this.height) return;
        const gl = this.gl;
        this.width = w;
        this.height = h;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, this.fmt.internal, w, h, 0, this.fmt.format, this.fmt.type, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    bind(): void {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.viewport(0, 0, this.width, this.height);
    }

    dispose(): void {
        this.gl.deleteTexture(this.texture);
        this.gl.deleteFramebuffer(this.fbo);
    }
}

export function pickHdrFormat(gl: GL): TargetFormat {
    const ext = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
    if (ext) return { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT };
    return { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
}

export function createFullscreenVao(gl: GL): WebGLVertexArrayObject {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
}

export function createDataTexture(gl: GL, w: number, h: number, filter: number = gl.LINEAR): WebGLTexture {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, w, h, 0, gl.RED, gl.FLOAT, new Float32Array(w * h));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
}

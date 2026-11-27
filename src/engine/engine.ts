// The render engine. One instance per canvas (the preview and the exporter
// each own one). render() is a pure function of (project, features, time) plus
// a little simulation state (particles, trails), so exports are reproducible.

import type { Features } from '../audio/features';
import { WAVE_POINTS } from '../audio/features';
import { BACKGROUND_MODES, type BackgroundMode, type Project } from '../project/types';
import { hash1, hexToRgb, noise1, rotateHue, type RGB } from './color';
import { createDataTexture, createFullscreenVao, FULLSCREEN_VS, pickHdrFormat, Program, RenderTarget, type GL } from './gl';
import { MAX_PARTICLES, ParticleSystem, PARTICLE_STRIDE } from './particles';
import { CENTER_SHADER, CROWD_SHADER, IMAGE_SHADER, PARTICLE_FS, PARTICLE_VS, PROGRESS_SHADER, SPECTRUM_SHADER, TEXT_SHADER } from './shaders/layers';
import { COPY_SHADER, DOWN_SHADER, FEEDBACK_SHADER, FINAL_SHADER, STREAK_SHADER, UP_SHADER } from './shaders/post';
import { backgroundShader, OVERLAY_SHADER } from './shaders/scene';
import { TextRenderer, type Glyphs } from './text';
import { activeCue } from '../project/lyrics';

export interface ImageSource {
    id: string;
    source: TexImageSource;
    width: number;
    height: number;
}

export interface FrameInfo {
    time: number;
    dt: number;
    /** Fade-in / fade-out are relative to this range (track or export range). */
    rangeStart: number;
    rangeEnd: number;
    frame: number;
}

export interface EngineImages {
    background: ImageSource | null;
    logo: ImageSource | null;
    watermark?: ImageSource | null;
}

export interface EngineOptions {
    preserveDrawingBuffer?: boolean;
    /** Release the GL context on dispose (only for throw-away canvases). */
    loseContextOnDispose?: boolean;
    fontWeight?: (family: string) => string;
    fontsVersion?: () => number;
}

const SPEC_HIST = 64;
/** history rows per second (frame-rate independent scrolling) */
const SPEC_RATE = 40;
const BLOOM_LEVELS = 6;
const STYLE_INDEX: Record<string, number> = {
    'radial-bars': 0,
    'radial-wave': 1,
    'linear-bars': 2,
    'linear-wave': 3,
    oscilloscope: 4,
    'circle-scope': 5,
    terrain: 6,
};
const COLOR_INDEX: Record<string, number> = { palette: 0, reactive: 1, rainbow: 2, mono: 3 };
const ANIM_INDEX: Record<string, number> = { none: 0, wave: 1, bounce: 2, jitter: 3, flicker: 4, explode: 5 };

interface CachedImage {
    tex: WebGLTexture;
    source: TexImageSource;
    w: number;
    h: number;
}

export class Engine {
    readonly gl: GL;
    width = 0;
    height = 0;
    private readonly vao: WebGLVertexArrayObject;
    private readonly scene: RenderTarget;
    private fxA: RenderTarget;
    private fxB: RenderTarget;
    private readonly bg2: RenderTarget;
    private readonly flareA: RenderTarget;
    private readonly flareB: RenderTarget;
    private readonly dof: RenderTarget[] = [];
    private readonly bloom: RenderTarget[] = [];
    private readonly bgPrograms = new Map<BackgroundMode, Program>();
    private readonly progs: Record<string, Program> = {};
    private specTex: WebGLTexture;
    private peakTex: WebGLTexture;
    private specBars = 0;
    private specRow = 0;
    private specAcc = 0;
    private readonly waveTex: WebGLTexture;
    private readonly waveData = new Float32Array(WAVE_POINTS * 2);
    private readonly particles = new ParticleSystem();
    private readonly particleVao: WebGLVertexArrayObject;
    private readonly particleBuf: WebGLBuffer;
    private readonly text: TextRenderer;
    private readonly images = new Map<string, CachedImage>();
    private readonly blackTex: WebGLTexture;
    private fbValid = false;
    private flareOut: RenderTarget | null = null;
    private boltFlash = 0;
    private lost = false;

    constructor(readonly canvas: HTMLCanvasElement | OffscreenCanvas, private readonly opts: EngineOptions = {}) {
        const gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
            powerPreference: 'high-performance',
        }) as GL | null;
        if (!gl) throw new Error('WebGL2 is not available in this browser.');
        this.gl = gl;
        if ('addEventListener' in canvas) {
            canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                this.lost = true;
            });
        }
        gl.getExtension('EXT_color_buffer_float');
        gl.getExtension('OES_texture_float_linear');
        const fmt = pickHdrFormat(gl);
        this.vao = createFullscreenVao(gl);
        this.scene = new RenderTarget(gl, fmt, 4, 4);
        this.fxA = new RenderTarget(gl, fmt, 4, 4);
        this.fxB = new RenderTarget(gl, fmt, 4, 4);
        this.bg2 = new RenderTarget(gl, fmt, 4, 4);
        this.flareA = new RenderTarget(gl, fmt, 4, 4);
        this.flareB = new RenderTarget(gl, fmt, 4, 4);
        for (let i = 0; i < 3; i++) this.dof.push(new RenderTarget(gl, fmt, 4, 4));
        for (let i = 0; i < BLOOM_LEVELS; i++) this.bloom.push(new RenderTarget(gl, fmt, 4, 4));

        const mk = (name: string, fs: string, vs = FULLSCREEN_VS) => (this.progs[name] = new Program(gl, vs, fs, name));
        mk('overlay', OVERLAY_SHADER);
        mk('spectrum', SPECTRUM_SHADER);
        mk('center', CENTER_SHADER);
        mk('text', TEXT_SHADER);
        mk('progress', PROGRESS_SHADER);
        mk('image', IMAGE_SHADER);
        mk('crowd', CROWD_SHADER);
        mk('copy', COPY_SHADER);
        mk('feedback', FEEDBACK_SHADER);
        mk('down', DOWN_SHADER);
        mk('up', UP_SHADER);
        mk('final', FINAL_SHADER);
        mk('streak', STREAK_SHADER);
        mk('particles', PARTICLE_FS, PARTICLE_VS);

        this.specTex = createDataTexture(gl, 64, SPEC_HIST, gl.NEAREST);
        this.peakTex = createDataTexture(gl, 64, 1, gl.NEAREST);
        this.specBars = 64;
        this.waveTex = createDataTexture(gl, WAVE_POINTS, 2, gl.LINEAR);

        this.blackTex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this.blackTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

        // particles: quad corners + per-instance data
        this.particleVao = gl.createVertexArray()!;
        gl.bindVertexArray(this.particleVao);
        const quad = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        this.particleBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuf);
        gl.bufferData(gl.ARRAY_BUFFER, MAX_PARTICLES * PARTICLE_STRIDE * 4, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, PARTICLE_STRIDE * 4, 0);
        gl.vertexAttribDivisor(1, 1);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, PARTICLE_STRIDE * 4, 16);
        gl.vertexAttribDivisor(2, 1);
        gl.bindVertexArray(null);

        this.text = new TextRenderer(gl);
    }

    get isLost(): boolean {
        return this.lost || this.gl.isContextLost();
    }

    setSize(w: number, h: number): void {
        w = Math.max(16, Math.round(w));
        h = Math.max(16, Math.round(h));
        if (w === this.width && h === this.height) return;
        this.width = w;
        this.height = h;
        this.canvas.width = w;
        this.canvas.height = h;
        this.scene.resize(w, h);
        this.fxA.resize(w, h);
        this.fxB.resize(w, h);
        this.bg2.resize(w, h);
        this.flareA.resize(Math.max(1, Math.floor(w / 4)), Math.max(1, Math.floor(h / 2)));
        this.flareB.resize(Math.max(1, Math.floor(w / 4)), Math.max(1, Math.floor(h / 2)));
        this.dof.forEach((d, i) => d.resize(Math.max(1, Math.floor(w / (2 << i))), Math.max(1, Math.floor(h / (2 << i)))));
        let bw = w;
        let bh = h;
        for (const b of this.bloom) {
            bw = Math.max(1, Math.floor(bw / 2));
            bh = Math.max(1, Math.floor(bh / 2));
            b.resize(bw, bh);
        }
        this.fbValid = false;
    }

    /** Clears simulation state (particles, trails). Call before an export. */
    reset(seed = 1): void {
        this.particles.reset(seed);
        this.fbValid = false;
        this.specAcc = 0;
    }

    private bgProgram(mode: BackgroundMode): Program {
        let p = this.bgPrograms.get(mode);
        if (!p) {
            p = new Program(this.gl, FULLSCREEN_VS, backgroundShader(mode), `bg-${mode}`);
            this.bgPrograms.set(mode, p);
        }
        return p;
    }

    /** Compiles every background variant up front (avoids hitches when switching). */
    warmup(): void {
        for (const m of BACKGROUND_MODES) this.bgProgram(m);
    }

    private imageTexture(img: ImageSource | null): CachedImage | null {
        if (!img) return null;
        const gl = this.gl;
        let c = this.images.get(img.id);
        if (c && c.source === img.source) return c;
        if (!c) {
            const tex = gl.createTexture()!;
            c = { tex, source: img.source, w: img.width, h: img.height };
            this.images.set(img.id, c);
        }
        c.source = img.source;
        c.w = img.width;
        c.h = img.height;
        gl.bindTexture(gl.TEXTURE_2D, c.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img.source);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
        return c;
    }

    private uploadSpectrum(f: Features, dt: number): void {
        const gl = this.gl;
        const bars = f.spectrum.length;
        if (bars !== this.specBars) {
            gl.deleteTexture(this.specTex);
            gl.deleteTexture(this.peakTex);
            this.specTex = createDataTexture(gl, bars, SPEC_HIST, gl.NEAREST);
            this.peakTex = createDataTexture(gl, bars, 1, gl.NEAREST);
            this.specBars = bars;
            this.specRow = 0;
        }
        gl.bindTexture(gl.TEXTURE_2D, this.peakTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, bars, 1, gl.RED, gl.FLOAT, f.peaks);
        gl.bindTexture(gl.TEXTURE_2D, this.specTex);
        if (dt > 0) {
            this.specAcc += dt * SPEC_RATE;
            let n = 0;
            while (this.specAcc >= 1 && n < SPEC_HIST) {
                this.specAcc -= 1;
                this.specRow = (this.specRow + 1) % SPEC_HIST;
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, this.specRow, bars, 1, gl.RED, gl.FLOAT, f.spectrum);
                n++;
            }
            this.specAcc = Math.min(this.specAcc, 0.999);
        }
        // the newest row is always live
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, this.specRow, bars, 1, gl.RED, gl.FLOAT, f.spectrum);
        this.waveData.set(f.wave, 0);
        this.waveData.set(f.waveR, WAVE_POINTS);
        gl.bindTexture(gl.TEXTURE_2D, this.waveTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, WAVE_POINTS, 2, gl.RED, gl.FLOAT, this.waveData);
    }

    private glyphUniforms(p: Program, g: Glyphs, anim: string, amount: number, reveal: number, dropB: number): Program {
        const idx = ANIM_INDEX[anim] ?? 0;
        return p
            .i('uAnim', idx)
            .f('uAnimAmt', amount)
            .v4arr('uGlyphA', g.a)
            .v4arr('uGlyphB', g.b)
            .i('uGlyphCount', idx > 0 || reveal < 1 ? g.count : 0)
            .v2('uTexPx', g.texW, g.texH)
            .f('uLineH', g.lineH)
            .f('uReveal', reveal)
            .f('uDropB', dropB);
    }

    private draw(): void {
        this.gl.bindVertexArray(this.vao);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
    }

    private common(p: Program, f: Features, palette: RGB[], move: number, spin: number, w: number, h: number): Program {
        p.v2('uRes', w, h)
            .f('uTime', f.time)
            .f('uMove', move)
            .f('uSpin', spin)
            .f('uKick', f.kick)
            .f('uBass', f.bass)
            .f('uSub', f.sub)
            .f('uLowMid', f.lowMid)
            .f('uMid', f.mid)
            .f('uHigh', f.high)
            .f('uEnergy', f.energy)
            .f('uIntensity', f.intensity)
            .f('uDrop', f.drop)
            .f('uBuild', f.build)
            .f('uBeat', f.beatPhase)
            .f('uBar', f.barPhase)
            .f('uBeatN', f.beatIndex)
            .f('uBeatPulse', f.beatPulse)
            .v3('uColA', palette[0])
            .v3('uColB', palette[1])
            .v3('uColC', palette[2]);
        const rk = f.recentKicks;
        p.v4('uKickAge', rk[0], rk[2], rk[4], rk[6]).v4('uKickStr', rk[1], rk[3], rk[5], rk[7]);
        return p;
    }

    private drawBackground(
        mode: BackgroundMode,
        bgTex: CachedImage | null,
        f: Features,
        palette: RGB[],
        move: number,
        spin: number,
        W: number,
        H: number,
        t: number,
        dyn: number,
        k15: number,
        P: Project,
    ): void {
        const bg = P.background;
        const bp = this.bgProgram(mode).use();
        this.common(bp, f, palette, move, spin, W, H)
            .f('uBgSpeed', bg.speed)
            .f('uBgScale', bg.scale)
            .f('uBgDetail', bg.detail)
            .f('uBgTwist', bg.twist)
            .f('uBgBright', bg.brightness)
            .f('uBgReact', bg.react)
            .tex('uImage', bgTex?.tex ?? this.blackTex)
            .v2('uImageSize', bgTex?.w ?? 1, bgTex?.h ?? 1)
            .f('uHasImage', bgTex ? 1 : 0)
            .f('uImgBlur', bg.imageBlur)
            .f('uImgDim', bg.imageDim)
            .f('uImgZoom', 1.03 + bg.imageDrift * 0.05 * (0.5 + 0.5 * Math.sin(t * 0.05)) + bg.imageKickZoom * (k15 * 0.06 + f.drop * 0.04) * dyn)
            .f('uImgRot', bg.imageDrift * 0.025 * Math.sin(t * 0.043))
            .f('uImgKaleido', bg.imageKaleido)
            .v2('uImgShift', bg.imageDrift * 0.03 * Math.sin(t * 0.031), bg.imageDrift * 0.02 * Math.cos(t * 0.023));
        this.draw();
    }

    render(project: Project, f: Features, info: FrameInfo, images: EngineImages): void {
        if (this.isLost) return;
        const gl = this.gl;
        const W = this.width;
        const H = this.height;
        const minDim = Math.min(W, H);
        const hsx = (0.5 * W) / minDim;
        const hsy = (0.5 * H) / minDim;
        const t = info.time;
        const dt = Math.max(0, Math.min(info.dt, 0.1));
        const P = project;
        const fx = P.fx;

        // ---- derived, deterministic per-frame values --------------------------------
        const hue = P.palette.hueSpeed * t + P.palette.dropHueShift * f.dropCount;
        const pl = P.palette;
        const hot = pl.dropColors ? Math.min(1, Math.max(0, (f.intensity - 0.42) / 0.33)) : 0;
        const hotS = hot * hot * (3 - 2 * hot);
        const calmCols = [pl.a, pl.b, pl.c].map(hexToRgb);
        const hotCols = pl.dropColors ? [pl.da, pl.db, pl.dc].map(hexToRgb) : calmCols;
        const palette: RGB[] = calmCols.map((c, i) =>
            rotateHue([c[0] + (hotCols[i][0] - c[0]) * hotS, c[1] + (hotCols[i][1] - c[1]) * hotS, c[2] + (hotCols[i][2] - c[2]) * hotS], hue),
        );
        const dyn = 1 - fx.dynamics + fx.dynamics * Math.min(1, Math.max(0.12, f.intensity * 1.25));
        const build = f.build * fx.buildBoost;
        const bg = P.background;
        const speedScale = 0.15 + bg.speed * 2.6;
        const move = speedScale * (0.45 * t + 0.9 * bg.react * f.travel + 1.6 * bg.react * f.kickTravel);
        const spin = (0.05 + bg.speed * 0.25) * t + bg.react * 0.35 * f.kickTravel;
        const kick = f.kick;
        const k15 = Math.pow(kick, 1.5);

        this.uploadSpectrum(f, dt);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        // ---- 1. background (plus the optional drop scene, blended in drops) --------------------
        const bgTex = this.imageTexture(images.background);
        const dropMode = bg.dropMode && bg.dropMode !== 'same' && bg.dropMode !== bg.mode ? bg.dropMode : null;
        const hotW = dropMode ? f.hot : 0;
        if (hotW < 0.999) {
            this.scene.bind();
            gl.disable(gl.BLEND);
            this.drawBackground(bg.mode, bgTex, f, palette, move, spin, W, H, t, dyn, k15, P);
        }
        if (dropMode && hotW > 0.001) {
            const target = hotW < 0.999 ? this.bg2 : this.scene;
            target.bind();
            gl.disable(gl.BLEND);
            this.drawBackground(dropMode, bgTex, f, palette, move, spin, W, H, t, dyn, k15, P);
            if (target === this.bg2) {
                this.scene.bind();
                gl.enable(gl.BLEND);
                gl.blendColor(0, 0, 0, hotW);
                gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
                this.progs.copy.use().tex('uTex', this.bg2.texture).f('uAmt', 1);
                this.draw();
                gl.disable(gl.BLEND);
            }
        }
        this.scene.bind();

        // ---- 2. overlays (additive) ------------------------------------------------------
        const ov = P.overlays;

        // lightning: on every drop, and on some big kicks in intense parts
        let boltAge = 99;
        let boltSeed = 0;
        if ((ov.lightning ?? 0) > 0.001) {
            if (f.dropAge < 0.3) {
                boltAge = f.dropAge;
                boltSeed = Math.round((t - f.dropAge) * 10) * 0.173 + 1;
            } else if (f.kickAge < 0.3 && f.recentKicks[1] > 0.7 && f.intensity > 0.55) {
                const kickId = Math.round((t - f.kickAge) * 100);
                if (hash1(kickId * 0.0731) < 0.08 + 0.3 * ov.lightning) {
                    boltAge = f.kickAge;
                    boltSeed = kickId * 0.0173 + 2;
                }
            }
        }
        const rays = ov.rays ?? 0;
        if (ov.fire > 0.001 || ov.lasers > 0.001 || ov.smoke > 0.001 || rays > 0.001 || boltAge < 0.3) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE);
            const op = this.progs.overlay.use();
            this.common(op, f, palette, move, spin, W, H)
                .f('uFireAmt', ov.fire)
                .f('uFireH', ov.fireHeight)
                .f('uLaserAmt', ov.lasers * (0.6 + 0.4 * dyn))
                .f('uSmokeAmt', ov.smoke)
                .f('uRaysAmt', rays * (0.5 + 0.5 * dyn))
                .v2('uRaysCenter', P.center.x * hsx, P.center.y * hsy)
                .f('uBoltAmt', boltAge < 0.3 ? ov.lightning : 0)
                .f('uBoltAge', boltAge)
                .f('uBoltSeed', boltSeed);
            this.draw();
        }
        this.boltFlash = boltAge < 0.3 ? ov.lightning * Math.exp(-boltAge / 0.06) * (boltAge < 0.05 || hash1(Math.floor(boltAge * 50) + boltSeed) > 0.3 ? 1 : 0.3) : 0;

        if (ov.crowd > 0.001) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            const cp = this.progs.crowd.use();
            this.common(cp, f, palette, move, spin, W, H).f('uCrowd', Math.min(1, ov.crowd)).f('uCrowdH', ov.crowdHeight);
            this.draw();
        }

        // ---- 3. fx layer with trails: spectrum + particles ----------------------------------
        this.fxB.bind();
        gl.disable(gl.BLEND);
        if (fx.trails > 0.001 && this.fbValid) {
            const decay = Math.pow(0.5 + 0.38 * fx.trails, dt * 60);
            const fp = this.progs.feedback.use();
            this.common(fp, f, palette, move, spin, W, H)
                .tex('uPrev', this.fxA.texture)
                .f('uDecay', decay)
                .f('uFbZoom', 1 + (fx.trailZoom * 0.025 * (1 + kick * 1.5)) * dt * 60)
                .f('uFbRot', fx.trailSpin * 0.02 * dt * 60);
            this.draw();
        } else {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        const sp = P.spectrum;
        const ctrX = P.center.x * hsx;
        const ctrY = P.center.y * hsy;
        const radialStyle = sp.style.startsWith('radial') || sp.style === 'circle-scope';
        const drawSpectrum = () => {
            const kickScale = 1 + sp.kickScale * k15 * 0.12;
            const spg = this.progs.spectrum.use();
            this.common(spg, f, palette, move, spin, W, H)
                .tex('uSpec', this.specTex)
                .tex('uPeaks', this.peakTex)
                .f('uSpPeaks', sp.peaks ? 1 : 0)
                .f('uSpecBars', this.specBars)
                .f('uSpecRow', this.specRow)
                .f('uSpecHist', SPEC_HIST)
                .f('uSpecPhase', this.specAcc)
                .f('uSpEcho', sp.echo ?? 0)
                .tex('uWave', this.waveTex)
                .i('uStyle', STYLE_INDEX[sp.style] ?? 0)
                .v2('uSpCenter', radialStyle ? ctrX : sp.x * hsx, radialStyle ? ctrY : sp.y * hsy)
                .f('uSpRadius', sp.radius * kickScale)
                .f('uSpHeight', sp.height * (1 + sp.kickScale * kick * 0.25))
                .f('uSpWidth', sp.width)
                .f('uSpThick', sp.thickness)
                .f('uSpGap', sp.gap)
                .f('uSpLayers', sp.layers)
                .f('uSpMirror', sp.mirror ? 1 : 0)
                .f('uSpRot', (sp.rotate * Math.PI) / 180 + (radialStyle ? P.center.spin * 0.15 * t : 0))
                .f('uSpOpacity', sp.opacity)
                .i('uSpColor', COLOR_INDEX[sp.colorMode] ?? 0);
            this.draw();
        };
        const terrainStyle = sp.style === 'terrain';
        if (sp.style !== 'none' && !terrainStyle) drawSpectrum();
        const pc = P.particles;
        this.particles.update(dt, pc, f, hsx, hsy, ctrX, ctrY, (P.center.enabled ? P.center.radius : sp.radius) * (1 + P.center.kickScale * k15 * 0.12), dyn);
        if (this.particles.count > 0) {
            const pp = this.progs.particles.use();
            pp.v2('uRes', W, H)
                .v3('uColA', palette[0])
                .v3('uColB', palette[1])
                .v3('uColC', palette[2])
                .i('uPColor', pc.colorMode === 'white' ? 1 : pc.colorMode === 'fire' ? 2 : 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuf);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.particles.data, 0, this.particles.count * PARTICLE_STRIDE);
            gl.bindVertexArray(this.particleVao);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.particles.count);
        }
        this.fbValid = true;

        // composite fx layer onto the scene
        this.scene.bind();
        gl.blendFunc(gl.ONE, gl.ONE);
        this.progs.copy.use().tex('uTex', this.fxB.texture).f('uAmt', 1);
        this.draw();
        const tmp = this.fxA;
        this.fxA = this.fxB;
        this.fxB = tmp;

        // dreamy soft focus in calm parts (behind the logo and text), sharpening into the drop
        const dofAmt = (fx.dreamy ?? 0) * (1 - f.hot) * (1 - f.build) * 0.85;
        if (dofAmt > 0.001) {
            gl.disable(gl.BLEND);
            let dsrc: RenderTarget = this.scene;
            for (const d of this.dof) {
                d.bind();
                this.progs.down.use().tex('uTex', dsrc.texture).v2('uTexel', 1 / dsrc.width, 1 / dsrc.height).f('uPrefilter', 0).f('uThreshold', 0);
                this.draw();
                dsrc = d;
            }
            this.scene.bind();
            gl.enable(gl.BLEND);
            gl.blendColor(0, 0, 0, dofAmt);
            gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
            const last = this.dof[this.dof.length - 1];
            this.progs.up.use().tex('uTex', last.texture).v2('uTexel', 1 / last.width, 1 / last.height).f('uWeight', 1);
            this.draw();
        }

        // terrain is opaque: its mountains hide what is behind them
        if (terrainStyle) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            drawSpectrum();
        }

        // ---- 4. center logo, text, progress (premultiplied over) ---------------------------
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const ct = P.center;
        // jelly: a damped squash-and-stretch after each kick
        let jelly = 0;
        let jellyRot = 0;
        const wob = (ct.wobble ?? 0) * dyn;
        if (wob > 0.001) {
            for (let k = 0; k < 2; k++) {
                const age = f.recentKicks[k * 2];
                const str = f.recentKicks[k * 2 + 1];
                if (age > 1.2) continue;
                jelly += wob * str * Math.exp(-age * 6.5) * Math.cos(age * 34);
                jellyRot += wob * str * 0.05 * Math.exp(-age * 5) * Math.sin(age * 23);
            }
        }
        if (ct.enabled) {
            const logo = this.imageTexture(images.logo);
            const cp = this.progs.center.use();
            this.common(cp, f, palette, move, spin, W, H)
                .tex('uLogo', logo?.tex ?? this.blackTex)
                .f('uHasLogo', logo ? 1 : 0)
                .v2('uLogoSize', logo?.w ?? 1, logo?.h ?? 1)
                .v2('uCtr', ctrX, ctrY)
                .f('uCtrR', ct.radius * (1 + ct.kickScale * k15 * 0.12 + f.drop * 0.05))
                .f('uRing', ct.ring)
                .f('uRingGlow', ct.ringGlow)
                .f('uCtrSpin', ct.spin * 0.6 * t + Math.sin(t * 2.1) * 0.03 * kick)
                .f('uShockRings', ct.shockRings * dyn)
                .f('uShape', ct.shape === 'vinyl' ? 2 : ct.shape === 'square' ? 1 : 0)
                .v2('uJelly', 1 + jelly * 0.075, 1 - jelly * 0.06)
                .f('uJellyRot', jellyRot)
                // 33 1/3 rpm, plus a quick back-spin "scratch" on every drop
                .f('uVinylSpin', -(t * Math.PI * 2 * 0.5556 + ct.spin * 0.6 * t) + 2.6 * f.drop * Math.exp(-f.dropAge * 2));
            this.draw();
        }

        const tx = P.text;
        const weight = this.opts.fontWeight ? this.opts.fontWeight(tx.font) : '700';
        const introLen = Math.max(0, tx.intro);
        const block = this.text.update(tx, P.meta, minDim, weight, this.opts.fontsVersion ? this.opts.fontsVersion() : 0, introLen > 0 ? 2 : 1);
        if (block) {
            const lastKickIdx = f.beatIndex;
            const glitchOn = hash1(Math.floor(t * 9) + lastKickIdx * 0.37) < 0.2 + tx.glitch * 0.6;
            const dropB = f.dropAge < 50 ? f.drop * Math.exp(-f.dropAge * (1 / 0.28 - 1 / 1.6)) : 0;
            let glitchT = tx.glitch * (Math.pow(kick, 3) * 0.9 + dropB * 0.9) * (glitchOn ? 1 : 0.15) * dyn;
            let px = block.cx * hsx + block.shift;
            let py = block.cy * hsy;
            let scale = 1 + tx.pulse * k15 * 0.07;
            // intro title card: big in the centre, then glides into place
            const tl = t - info.rangeStart;
            if (introLen > 0 && tl >= 0 && tl < introLen + 0.9) {
                const x = Math.min(1, Math.max(0, (tl - introLen + 0.1) / 0.9));
                const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
                const big = Math.min(1.9, (hsx * 1.6) / Math.max(1e-3, block.halfW * 2));
                px = px * e;
                py = py * e;
                scale *= big + (1 - big) * e;
                if (tl < 0.5) glitchT = Math.max(glitchT, (0.5 - tl) * 1.2);
            }
            const reveal = introLen > 0 && tl >= 0 ? Math.min(1, tl / 1.1) : 1;
            const tp = this.progs.text.use();
            this.common(tp, f, palette, move, spin, W, H)
                .tex('uTextTex', block.texture)
                .v2('uTextPos', px, py)
                .v2('uTextHalf', block.halfW, block.halfH)
                .f('uTextScale', scale)
                .f('uGlitchT', Math.min(1, glitchT))
                .f('uGlitchSeed', Math.floor(t * 20))
                .f('uTextAlpha', 1);
            this.glyphUniforms(tp, block.glyphs, tx.anim ?? 'none', (tx.animAmount ?? 0.5) * (0.4 + 0.6 * dyn), reveal, dropB);
            this.draw();
        }

        // lyrics / subtitles
        const cue = P.lyrics.cues.length ? activeCue(P.lyrics.cues, t) : null;
        if (cue) {
            const lb = this.text.updateLyric(cue.text, P.lyrics, tx, minDim, weight, this.opts.fontsVersion ? this.opts.fontsVersion() : 0);
            const age = t - cue.start;
            const left = cue.end - t;
            const alpha = Math.min(1, age / 0.12, left / 0.2);
            const pop = 1 + 0.08 * Math.exp(-age / 0.08) + tx.pulse * k15 * 0.04;
            const lp = this.progs.text.use();
            this.common(lp, f, palette, move, spin, W, H)
                .tex('uTextTex', lb.texture)
                .v2('uTextPos', 0, lb.cy * hsy)
                .v2('uTextHalf', lb.halfW, lb.halfH)
                .f('uTextScale', pop)
                .f('uGlitchT', Math.max(0, 0.5 - age * 4) + tx.glitch * Math.pow(kick, 4) * 0.4 * dyn)
                .f('uGlitchSeed', Math.floor(t * 20) + 7)
                .f('uTextAlpha', Math.max(0, alpha));
            const dropL = f.dropAge < 50 ? f.drop * Math.exp(-f.dropAge * (1 / 0.28 - 1 / 1.6)) : 0;
            this.glyphUniforms(lp, lb.glyphs, tx.anim ?? 'none', (tx.animAmount ?? 0.5) * 0.8 * (0.4 + 0.6 * dyn), Math.min(1, age / 0.35), dropL);
            this.draw();
        }

        const wm = P.watermark;
        const wmImg = this.imageTexture(images.watermark ?? null);
        if (wmImg && wm.opacity > 0.001) {
            const halfH = (wm.size / 2) * (1 + wm.pulse * k15 * 0.08);
            const halfW = halfH * (wmImg.w / Math.max(1, wmImg.h));
            const sx = wm.corner === 'tl' || wm.corner === 'bl' ? -1 : 1;
            const sy = wm.corner === 'tl' || wm.corner === 'tr' ? 1 : -1;
            const baseH = wm.size / 2;
            const baseW = baseH * (wmImg.w / Math.max(1, wmImg.h));
            const ip = this.progs.image.use();
            ip.v2('uRes', W, H)
                .tex('uImg', wmImg.tex)
                .v2('uImgPos', sx * (hsx - wm.margin - baseW), sy * (hsy - wm.margin - baseH))
                .v2('uImgHalf', halfW, halfH)
                .f('uImgOpacity', wm.opacity);
            this.draw();
        }

        const pr = P.progress;
        if (pr.enabled) {
            const rangeLen = Math.max(1e-3, info.rangeEnd - info.rangeStart);
            const pg = this.progs.progress.use();
            this.common(pg, f, palette, move, spin, W, H)
                .f('uProgress', Math.max(0, Math.min(1, rangeLen > 1e5 ? f.progress : (t - info.rangeStart) / rangeLen)))
                .f('uPrY', pr.y * hsy)
                .f('uPrThick', pr.thickness)
                .v3('uPrColor', hexToRgb(pr.color))
                .f('uPrGlow', pr.glow);
            this.draw();
        }

        // ---- 5. bloom ----------------------------------------------------------------------
        gl.disable(gl.BLEND);
        const down = this.progs.down;
        let src = this.scene;
        for (let i = 0; i < BLOOM_LEVELS; i++) {
            const dst = this.bloom[i];
            dst.bind();
            down.use()
                .tex('uTex', src.texture)
                .v2('uTexel', 1 / src.width, 1 / src.height)
                .f('uPrefilter', i === 0 ? 1 : 0)
                .f('uThreshold', fx.bloomThreshold);
            this.draw();
            src = dst;
        }
        // anamorphic streaks from the bright pass (quarter res, squashed vertically)
        const flareAmt = fx.flare * (0.7 + 0.6 * kick + 0.4 * f.drop);
        if (fx.flare > 0.001) {
            const sk = this.progs.streak;
            let fsrc: RenderTarget = this.bloom[0];
            let fdst = this.flareA;
            const steps = [1, 3, 9, 27];
            for (let i = 0; i < steps.length; i++) {
                fdst.bind();
                sk.use()
                    .tex('uTex', fsrc.texture)
                    .v2('uTexel', 1 / fsrc.width, 1 / fsrc.height)
                    .f('uStep', steps[i] * (fdst.width / 480))
                    .f('uGain', i === 0 ? 1.6 : 1)
                    .f('uKnee', i === 0 ? 0.35 : 0);
                this.draw();
                fsrc = fdst;
                fdst = fdst === this.flareA ? this.flareB : this.flareA;
            }
            this.flareOut = fsrc;
        }

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        const up = this.progs.up;
        const weightUp = 0.55 + fx.bloomRadius * 0.6;
        for (let i = BLOOM_LEVELS - 1; i > 0; i--) {
            const s = this.bloom[i];
            this.bloom[i - 1].bind();
            up.use().tex('uTex', s.texture).v2('uTexel', 1 / s.width, 1 / s.height).f('uWeight', weightUp);
            this.draw();
        }
        gl.disable(gl.BLEND);

        // ---- 6. final composite --------------------------------------------------------------
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, W, H);
        const shakeAmp = fx.shake * (k15 * 0.022 + f.drop * 0.018 + build * 0.012 * (0.4 + 0.6 * f.beatPulse)) * dyn;
        const st = t * 32;
        const shakeX = shakeAmp * noise1(st, 1);
        const shakeY = shakeAmp * noise1(st, 2);
        const shakeRot = shakeAmp * 0.8 * noise1(st * 0.7, 3);
        let zoom = 1 + shakeAmp * 2.5 + fx.zoomPunch * (Math.pow(kick, 2) * 0.055 + f.drop * 0.05) * dyn + build * 0.05;
        // beat-synced camera cuts: a new framing on every bar in intense parts
        let cutRot = 0;
        let cutX = 0;
        let cutY = 0;
        const cutAmt = fx.cuts * Math.min(1, Math.max(0, (f.intensity - 0.5) / 0.25));
        if (cutAmt > 0.001) {
            const b = f.barIndex;
            cutRot = (hash1(b * 1.31 + 7) - 0.5) * 0.14 * cutAmt;
            cutX = (hash1(b * 2.07 + 3) - 0.5) * 0.06 * cutAmt;
            cutY = (hash1(b * 0.73 + 11) - 0.5) * 0.04 * cutAmt;
            zoom *= 1 + (0.03 + hash1(b * 1.97 + 5) * 0.1) * cutAmt + Math.abs(cutRot) * 1.1;
        }
        // living camera: slow drift, plus a roll that builds up into each drop and snaps back on it
        const drift = fx.drift ?? 0;
        const driftRot = drift * (0.02 * Math.sin(t * 0.11) + 0.009 * Math.sin(t * 0.27 + 1.3));
        const buildRoll = fx.buildBoost * Math.pow(f.build, 2.2) * 0.16 * (f.dropCount % 2 === 0 ? 1 : -1);
        cutRot += driftRot + buildRoll;
        cutX += drift * 0.012 * Math.sin(t * 0.09 + 2.1);
        cutY += drift * 0.008 * Math.sin(t * 0.13 + 0.7);
        zoom *= 1 + drift * (0.02 + 0.015 * Math.sin(t * 0.07 + 0.5)) + Math.abs(driftRot + buildRoll) * 1.1;
        const dropBurst = f.dropAge < 50 ? f.drop * Math.exp(-f.dropAge * (1 / 0.28 - 1 / 1.6)) : 0;
        const glitchSeed = Math.floor(t * 24);
        const kickIdx = Math.round(f.time * 1000 - f.kickAge * 1000);
        const strongKick = f.recentKicks[1] > 0.6 && hash1(kickIdx * 0.013) < 0.15 + 0.85 * fx.glitch;
        const glitch = fx.glitch * ((strongKick ? Math.exp(-f.kickAge / 0.09) : 0) * 0.8 + dropBurst * 1.2 + Math.pow(build, 3) * 0.6) * dyn;
        const period = 60 / Math.max(30, f.bpm);
        const strobe = fx.strobe * Math.exp(-(f.beatPhase * period) / 0.035) * (f.section === 'drop' || f.section === 'main' ? 1 : 0.25) * dyn;
        const flash = fx.flash * (Math.pow(kick, 3) * 0.2 * dyn + dropBurst * 0.75) + strobe * 0.9 + this.boltFlash * 0.25;
        const fadeIn = fx.fadeIn > 0 ? Math.min(1, Math.max(0, (t - info.rangeStart) / fx.fadeIn)) : 1;
        const fadeOut = fx.fadeOut > 0 ? Math.min(1, Math.max(0, (info.rangeEnd - t) / fx.fadeOut)) : 1;
        const fl = palette[0];
        const fp = this.progs.final.use();
        this.common(fp, f, palette, move, spin, W, H)
            .tex('uScene', this.scene.texture)
            .tex('uBloom', this.bloom[0].texture)
            .f('uBloomAmt', fx.bloom * (0.85 + 0.45 * kick + 0.3 * dropBurst))
            .tex('uFlare', (this.flareOut ?? this.flareA).texture)
            .f('uFlareAmt', fx.flare > 0.001 ? flareAmt * 2.4 : 0)
            .f('uZoomBlur', Math.min(0.5, (fx.zoomBlur ?? 0) * (Math.pow(kick, 2) * 0.6 + dropBurst * 0.45) * dyn))
            .v2('uZbCenter', ctrX / (2 * hsx) + 0.5, ctrY / (2 * hsy) + 0.5)
            .v3('uFlareTint', [0.35 + 0.4 * palette[0][0], 0.45 + 0.4 * palette[0][1], 0.75 + 0.25 * palette[0][2]])

            .f('uCA', fx.chromatic * (0.15 + 0.85 * kick + 1.5 * dropBurst) * dyn)
            .f('uGlitch', Math.min(1, glitch))
            .f('uGlitchSeed', glitchSeed)
            .f('uShock', fx.shockwave * dyn)
            .v2('uShockCenter', ctrX, ctrY)
            .f('uFlash', flash)
            .v3('uFlashColor', [0.75 + 0.25 * fl[0], 0.75 + 0.25 * fl[1], 0.75 + 0.25 * fl[2]])
            .f('uVignette', fx.vignette)
            .f('uGrain', fx.grain)
            .f('uScan', fx.scanlines)
            .f('uExposure', fx.exposure)
            .f('uContrast', fx.contrast)
            .f('uSaturation', fx.saturation)
            .f('uFade', fadeIn * fadeOut)
            .f('uLetterbox', fx.letterbox)
            .v2('uShake', shakeX + cutX, shakeY + cutY)
            .f('uShakeRot', shakeRot + cutRot)
            .f('uZoom', zoom)
            .f('uFrame', info.frame);
        this.draw();
        gl.bindVertexArray(null);
    }

    dispose(): void {
        const gl = this.gl;
        for (const p of Object.values(this.progs)) p.dispose();
        for (const p of this.bgPrograms.values()) p.dispose();
        this.scene.dispose();
        this.fxA.dispose();
        this.fxB.dispose();
        this.bg2.dispose();
        this.flareA.dispose();
        this.flareB.dispose();
        for (const d of this.dof) d.dispose();
        for (const b of this.bloom) b.dispose();
        for (const c of this.images.values()) gl.deleteTexture(c.tex);
        gl.deleteTexture(this.specTex);
        gl.deleteTexture(this.peakTex);
        gl.deleteTexture(this.waveTex);
        gl.deleteTexture(this.blackTex);
        this.text.dispose();
        if (this.opts.loseContextOnDispose) gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
}

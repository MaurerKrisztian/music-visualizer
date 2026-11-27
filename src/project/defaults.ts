import type { Project } from './types';

export function createDefaultProject(): Project {
    return {
        version: 2,
        name: 'Untitled',
        meta: { artist: 'ARTIST NAME', title: 'Track Title' },
        sync: { sensitivity: 0.5, bpmOverride: null, beatOffsetMs: 0, kickDecay: 0.18, previewOffsetMs: 0, addedDrops: [], removedDrops: [] },
        palette: { a: '#00e5ff', b: '#7a2cff', c: '#ff2bd6', hueSpeed: 0, dropHueShift: 40, dropColors: false, da: '#ff1744', db: '#ff9100', dc: '#ffffff' },
        background: {
            mode: 'tunnel',
            dropMode: 'same',
            imageId: null,
            imageBlur: 0.15,
            imageDim: 0.35,
            imageKickZoom: 0.5,
            imageDrift: 0.4,
            imageKaleido: 0,
            speed: 0.5,
            scale: 0.5,
            detail: 0.5,
            twist: 0.3,
            brightness: 0.8,
            react: 0.7,
        },
        overlays: { fire: 0, lasers: 0.35, smoke: 0.25, fireHeight: 0.3, crowd: 0, crowdHeight: 0.4, rays: 0, lightning: 0 },
        spectrum: {
            style: 'radial-bars',
            bars: 72,
            x: 0,
            y: -0.55,
            radius: 0.17,
            height: 0.16,
            width: 0.9,
            thickness: 0.004,
            gap: 0.35,
            layers: 4,
            mirror: true,
            rotate: 0,
            kickScale: 0.6,
            colorMode: 'palette',
            opacity: 1,
            peaks: true,
            echo: 0,
            smooth: 0,
            release: 0.16,
            minHz: 30,
            maxHz: 14000,
            gainDb: 0,
            rangeDb: 55,
            tiltDb: 3,
        },
        center: {
            enabled: true,
            shape: 'circle',
            imageId: null,
            x: 0,
            y: 0.08,
            radius: 0.15,
            kickScale: 0.6,
            ring: 0.6,
            ringGlow: 0.7,
            spin: 0,
            shockRings: 0.7,
            wobble: 0.3,
        },
        particles: { mode: 'warp', count: 350, size: 0.4, speed: 0.5, kickBoost: 0.7, opacity: 0.8, colorMode: 'palette', dropBurst: true },
        text: {
            enabled: true,
            font: 'Orbitron',
            x: 0,
            y: -0.76,
            size: 0.055,
            subSize: 0.55,
            spacing: 0.12,
            uppercase: true,
            color: '#ffffff',
            subColor: '#c8f6ff',
            stroke: 0,
            strokeColor: '#000000',
            glow: 0.5,
            pulse: 0.35,
            glitch: 0.25,
            align: 'center',
            intro: 3,
            anim: 'bounce',
            animAmount: 0.5,
        },
        lyrics: { cues: [], y: -0.42, size: 0.045, color: '#ffffff', glow: 0.5, uppercase: false },
        watermark: { imageId: null, corner: 'tr', size: 0.11, margin: 0.035, opacity: 0.85, pulse: 0.25 },
        fx: {
            bloom: 0.75,
            flare: 0,
            bloomThreshold: 0.55,
            bloomRadius: 0.6,
            shake: 0.45,
            zoomPunch: 0.45,
            chromatic: 0.35,
            glitch: 0.25,
            shockwave: 0.4,
            flash: 0.3,
            strobe: 0,
            trails: 0.2,
            trailZoom: 0.4,
            trailSpin: 0,
            vignette: 0.55,
            grain: 0.12,
            scanlines: 0,
            exposure: 1,
            contrast: 1.05,
            saturation: 1.1,
            letterbox: 0,
            dynamics: 0.6,
            buildBoost: 0.5,
            cuts: 0,
            drift: 0.35,
            zoomBlur: 0.3,
            dreamy: 0,
            vhs: 0,
            fadeIn: 1,
            fadeOut: 2,
        },
        progress: { enabled: false, y: -0.93, thickness: 0.004, color: '#ffffff', glow: 0.5 },
        export: {
            resolution: '1080p',
            fps: 60,
            format: 'mp4',
            quality: 'high',
            rangeStart: null,
            rangeEnd: null,
            audioFadeOut: 0,
        },
    };
}

/** Deep-merges a partial object into a base (arrays and primitives replace). */
export function deepMerge<T>(base: T, patch: unknown): T {
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return (patch === undefined ? base : patch) as T;
    if (base === null || typeof base !== 'object' || Array.isArray(base)) return patch as T;
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
        if (v === undefined) continue;
        out[k] = k in out ? deepMerge(out[k], v) : v;
    }
    return out as T;
}

/** Upgrades / sanitises any loaded project to the current schema. */
export function normalizeProject(raw: unknown): Project {
    const base = createDefaultProject();
    if (!raw || typeof raw !== 'object') return base;
    const p = deepMerge(base, raw);
    p.version = 2;
    return p;
}

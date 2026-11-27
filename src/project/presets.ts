// Genre presets. Each one is a patch on top of the defaults; applying a preset
// keeps the user's track text, images, sync and export settings.

import { createDefaultProject, deepMerge } from './defaults';
import type { Project } from './types';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export interface Preset {
    id: string;
    name: string;
    tags: string;
    swatch: [string, string, string];
    /** shown under its own heading in the gallery */
    group?: 'simple' | 'popular';
    patch: DeepPartial<Project>;
}

/** Calm post-processing for the simple looks: no shake, glitch or flashes. */
const CLEAN_FX: DeepPartial<Project['fx']> = {
    bloom: 0.3,
    flare: 0,
    shake: 0,
    zoomPunch: 0.08,
    chromatic: 0,
    glitch: 0,
    shockwave: 0,
    flash: 0,
    strobe: 0,
    trails: 0,
    vignette: 0.35,
    grain: 0.03,
    scanlines: 0,
    letterbox: 0,
    dynamics: 0.25,
    buildBoost: 0.15,
    cuts: 0,
    drift: 0,
    zoomBlur: 0,
    dreamy: 0,
};
const CLEAN_TEXT: DeepPartial<Project['text']> = { glitch: 0, glow: 0.2, pulse: 0.1, anim: 'none', stroke: 0 };
const NO_OVERLAYS: DeepPartial<Project['overlays']> = { lasers: 0, smoke: 0, fire: 0, rays: 0, lightning: 0, crowd: 0 };

export const PRESETS: Preset[] = [
    {
        id: 'euphoric',
        name: 'Euphoric Hardstyle',
        tags: 'hardstyle · euphoric · scene switch on drop',
        swatch: ['#00e5ff', '#7a2cff', '#ff2bd6'],
        patch: {
            palette: { a: '#00e5ff', b: '#2a5cff', c: '#7c4dff', hueSpeed: 0, dropHueShift: 0, dropColors: true, da: '#ff2bd6', db: '#7a2cff', dc: '#00e5ff' },
            background: { mode: 'nebula', dropMode: 'tunnel', speed: 0.45, scale: 0.45, detail: 0.5, twist: 0.3, brightness: 0.75, react: 0.7 },
            overlays: { lasers: 0.4, smoke: 0.3, fire: 0, rays: 0.35 },
            spectrum: { style: 'radial-bars', bars: 64, radius: 0.15, height: 0.15, gap: 0.35, colorMode: 'palette', kickScale: 0.6, echo: 0.5 },
            center: { enabled: true, radius: 0.15, ring: 0.6, ringGlow: 0.7, shockRings: 0.6 },
            particles: { mode: 'warp', count: 320, size: 0.4, speed: 0.5, kickBoost: 0.7, colorMode: 'palette' },
            text: { font: 'Orbitron', glitch: 0.25, glow: 0.5, anim: 'wave', animAmount: 0.45 },
            fx: { bloom: 0.75, flare: 0.35, shake: 0.4, zoomPunch: 0.45, chromatic: 0.3, glitch: 0.2, shockwave: 0.4, flash: 0.35, trails: 0.1, grain: 0.1, drift: 0.4, dreamy: 0.55, zoomBlur: 0.35 },
        },
    },
    {
        id: 'rawstyle',
        name: 'Rawstyle Inferno',
        tags: 'rawstyle · raw · xtra raw',
        swatch: ['#ff3d00', '#ff0033', '#ffc400'],
        patch: {
            palette: { a: '#ff5a00', b: '#ff0033', c: '#ffc400', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'tunnel', speed: 0.6, scale: 0.6, detail: 0.15, twist: 0.5, brightness: 0.7, react: 0.85 },
            overlays: { fire: 0.85, fireHeight: 0.28, smoke: 0.35, lasers: 0, lightning: 0.35 },
            spectrum: { style: 'radial-wave', layers: 3, radius: 0.15, height: 0.13, colorMode: 'palette', kickScale: 0.8 },
            center: { enabled: true, radius: 0.15, ring: 0.8, ringGlow: 0.9, shockRings: 0.9, wobble: 0.55 },
            particles: { mode: 'embers', count: 450, size: 0.45, speed: 0.6, kickBoost: 0.9, colorMode: 'fire' },
            text: { font: 'Black Ops One', glitch: 0.5, glow: 0.45, color: '#ffffff', subColor: '#ffb199', anim: 'jitter', animAmount: 0.45 },
            fx: { bloom: 0.75, shake: 0.75, zoomPunch: 0.6, chromatic: 0.5, glitch: 0.45, shockwave: 0.65, flash: 0.35, grain: 0.22, contrast: 1.15, vignette: 0.7, trails: 0.1, cuts: 0.45, zoomBlur: 0.55 },
        },
    },
    {
        id: 'uptempo',
        name: 'Uptempo Terror',
        tags: 'uptempo · terror · hardcore',
        swatch: ['#ff0022', '#ffffff', '#5c0010'],
        patch: {
            palette: { a: '#ff0022', b: '#ffffff', c: '#7a0010', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'hex', speed: 0.8, scale: 0.55, detail: 0.8, twist: 0.4, brightness: 0.6, react: 1 },
            overlays: { lasers: 0, smoke: 0.2, fire: 0, lightning: 0.85 },
            spectrum: { style: 'radial-bars', bars: 48, radius: 0.14, height: 0.17, gap: 0.2, colorMode: 'reactive', kickScale: 1, echo: 0.6 },
            center: { enabled: true, radius: 0.14, ring: 1, ringGlow: 0.6, shockRings: 1 },
            particles: { mode: 'sparks', count: 500, size: 0.35, speed: 0.8, kickBoost: 1, colorMode: 'white' },
            text: { font: 'UnifrakturMaguntia', uppercase: false, spacing: 0.04, size: 0.065, glitch: 0.8, glow: 0.35, color: '#ffffff', subColor: '#ff4d5e', anim: 'jitter', animAmount: 0.75 },
            fx: { bloom: 0.6, bloomThreshold: 0.6, shake: 0.9, zoomPunch: 0.7, chromatic: 0.75, glitch: 0.8, shockwave: 0.8, flash: 0.45, strobe: 0.25, scanlines: 0.35, grain: 0.35, contrast: 1.25, saturation: 0.95, vignette: 0.75, dynamics: 0.5, cuts: 0.7, zoomBlur: 0.5 },
        },
    },
    {
        id: 'frenchcore',
        name: 'Frenchcore Chaos',
        tags: 'frenchcore · hardcore · psy',
        swatch: ['#39ff14', '#ff00aa', '#fff200'],
        patch: {
            palette: { a: '#39ff14', b: '#ff00aa', c: '#fff200', hueSpeed: 6, dropHueShift: 90 },
            background: { mode: 'kaleido', speed: 0.7, scale: 0.5, detail: 0.45, twist: 0.6, brightness: 0.55, react: 1 },
            overlays: { lasers: 0, smoke: 0, fire: 0 },
            spectrum: { style: 'circle-scope', radius: 0.15, height: 0.16, thickness: 0.006, colorMode: 'rainbow', kickScale: 0.8, echo: 0.7 },
            center: { enabled: true, radius: 0.14, ring: 0.5, ringGlow: 0.8, shockRings: 0.8, spin: 0.3 },
            particles: { mode: 'orbit', count: 650, size: 0.35, speed: 0.7, kickBoost: 1, colorMode: 'palette' },
            text: { font: 'Rubik Glitch', glitch: 0.7, glow: 0.6, anim: 'explode', animAmount: 0.85 },
            fx: { bloom: 0.6, bloomThreshold: 0.65, shake: 0.7, zoomPunch: 0.6, chromatic: 0.6, glitch: 0.6, shockwave: 0.6, flash: 0.25, trails: 0.45, trailZoom: 0.6, trailSpin: 0.25, grain: 0.15, cuts: 0.5, zoomBlur: 0.6 },
        },
    },
    {
        id: 'gabber',
        name: "Gabber '95",
        tags: 'gabber · early hardcore · rave',
        swatch: ['#ffe600', '#ff5e00', '#00c8ff'],
        patch: {
            palette: { a: '#ffe600', b: '#ff5e00', c: '#00c8ff', hueSpeed: 0, dropHueShift: 180 },
            background: { mode: 'grid', speed: 0.7, scale: 0.5, detail: 0.8, twist: 0.4, brightness: 1, react: 0.8 },
            overlays: { lasers: 0, smoke: 0, fire: 0 },
            spectrum: { style: 'terrain', bars: 64, y: -0.62, width: 1.1, height: 0.2, thickness: 0.004, mirror: true, colorMode: 'palette', kickScale: 0.3 },
            center: { enabled: false },
            particles: { mode: 'none' },
            text: { font: 'Bungee', y: 0.55, size: 0.07, glitch: 0.4, glow: 0.4, color: '#ffe600', subColor: '#ffffff', anim: 'bounce', animAmount: 0.8 },
            fx: { bloom: 0.6, shake: 0.6, zoomPunch: 0.5, chromatic: 0.55, glitch: 0.35, shockwave: 0.2, flash: 0.3, scanlines: 0.55, grain: 0.3, contrast: 1.1, vignette: 0.6, zoomBlur: 0.4 },
        },
    },
    {
        id: 'mainstage',
        name: 'Mainstage Pyro',
        tags: 'hardstyle · festival · anthem',
        swatch: ['#ffb300', '#ffffff', '#2979ff'],
        patch: {
            palette: { a: '#ffb300', b: '#ffe2a0', c: '#2979ff', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'stage', speed: 0.5, scale: 0.45, detail: 0.6, twist: 0.6, brightness: 0.95, react: 0.7 },
            overlays: { fire: 0.65, fireHeight: 0.2, smoke: 0.35, lasers: 0.35, crowd: 1, crowdHeight: 0.35, rays: 0.3 },
            spectrum: { style: 'radial-wave', layers: 4, radius: 0.15, height: 0.12, colorMode: 'palette', kickScale: 0.6 },
            center: { enabled: true, radius: 0.15, ring: 0.5, ringGlow: 0.8, shockRings: 0.5 },
            particles: { mode: 'confetti', count: 500, size: 0.45, speed: 0.6, kickBoost: 0.8, colorMode: 'palette' },
            text: { font: 'Michroma', spacing: 0.18, size: 0.045, glitch: 0.1, glow: 0.55, anim: 'bounce', animAmount: 0.4 },
            fx: { bloom: 0.7, bloomThreshold: 0.65, flare: 0.55, shake: 0.4, zoomPunch: 0.4, chromatic: 0.2, glitch: 0.1, shockwave: 0.35, flash: 0.4, grain: 0.08, trails: 0, cuts: 0.3, zoomBlur: 0.3 },
        },
    },
    {
        id: 'hyperspace',
        name: 'Hyperspace',
        tags: 'hardstyle · trance · techno',
        swatch: ['#2af5ff', '#3d5afe', '#ffffff'],
        patch: {
            palette: { a: '#2af5ff', b: '#3d5afe', c: '#e0f7ff', hueSpeed: 0, dropHueShift: 60 },
            background: { mode: 'warp', speed: 0.6, scale: 0.6, detail: 0.6, twist: 0.2, brightness: 1, react: 0.9 },
            overlays: { lasers: 0, smoke: 0, fire: 0 },
            spectrum: { style: 'radial-bars', bars: 90, radius: 0.16, height: 0.12, gap: 0.45, colorMode: 'palette', kickScale: 0.5, echo: 0.8 },
            center: { enabled: true, radius: 0.16, ring: 0.4, ringGlow: 0.6, shockRings: 0.4 },
            particles: { mode: 'none' },
            text: { font: 'Audiowide', glitch: 0.15, anim: 'wave', animAmount: 0.35 },
            fx: { bloom: 0.8, flare: 0.5, shake: 0.3, zoomPunch: 0.4, chromatic: 0.4, glitch: 0.1, shockwave: 0.3, flash: 0.25, trails: 0.5, trailZoom: 0.5, drift: 0.55, zoomBlur: 0.5 },
        },
    },
    {
        id: 'artwork',
        name: 'Artwork Pulse',
        tags: 'any genre · cover art · upload',
        swatch: ['#ffffff', '#ff4081', '#7c4dff'],
        patch: {
            palette: { a: '#ffffff', b: '#ff4081', c: '#7c4dff', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'image', imageBlur: 0.35, imageDim: 0.45, imageKickZoom: 0.6, imageDrift: 0.5, imageKaleido: 0, brightness: 0.9, react: 0.6 },
            overlays: { lasers: 0, smoke: 0.15, fire: 0 },
            spectrum: { style: 'radial-bars', bars: 72, radius: 0.16, height: 0.13, gap: 0.4, colorMode: 'mono', kickScale: 0.5 },
            center: { enabled: true, shape: 'square', radius: 0.17, ring: 0.35, ringGlow: 0.5, shockRings: 0.4, wobble: 0.5 },
            particles: { mode: 'dust', count: 220, size: 0.5, speed: 0.4, kickBoost: 0.5, colorMode: 'white' },
            text: { font: 'Bebas Neue', size: 0.07, spacing: 0.1, glitch: 0.15, anim: 'bounce', animAmount: 0.4 },
            fx: { bloom: 0.55, bloomThreshold: 0.7, shake: 0.35, zoomPunch: 0.45, chromatic: 0.25, glitch: 0.1, shockwave: 0.3, flash: 0.2, grain: 0.08, trails: 0, zoomBlur: 0.3 },
        },
    },
    {
        id: 'vinyl',
        name: 'Vinyl Spin',
        tags: 'classics · any genre · record',
        swatch: ['#ffb74d', '#ff5252', '#7c4dff'],
        patch: {
            palette: { a: '#ffb74d', b: '#ff5252', c: '#7c4dff', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'nebula', speed: 0.3, scale: 0.35, detail: 0.5, twist: 0.3, brightness: 0.55, react: 0.5 },
            overlays: { lasers: 0, smoke: 0.2, fire: 0, rays: 0.25 },
            spectrum: { style: 'radial-wave', layers: 4, radius: 0.2, height: 0.11, thickness: 0.003, colorMode: 'palette', kickScale: 0.5 },
            center: { enabled: true, shape: 'vinyl', radius: 0.2, ring: 0.15, ringGlow: 0.3, shockRings: 0.35, wobble: 0.35 },
            particles: { mode: 'dust', count: 200, size: 0.5, speed: 0.3, kickBoost: 0.5, colorMode: 'white' },
            text: { font: 'Bebas Neue', size: 0.065, spacing: 0.1, y: -0.8, glitch: 0.1, anim: 'wave', animAmount: 0.3 },
            fx: { bloom: 0.6, flare: 0.3, shake: 0.25, zoomPunch: 0.35, chromatic: 0.15, glitch: 0.05, shockwave: 0.2, flash: 0.15, trails: 0, grain: 0.1, vignette: 0.65, dreamy: 0.3, zoomBlur: 0.2 },
        },
    },
    {
        id: 'halo',
        name: 'Layered Halo',
        tags: 'edm · trap · dubstep · any',
        swatch: ['#ff3cac', '#784ba0', '#2b86c5'],
        patch: {
            palette: { a: '#ff3cac', b: '#784ba0', c: '#2b86c5', hueSpeed: 0, dropHueShift: 30 },
            background: { mode: 'image', imageBlur: 0.6, imageDim: 0.55, imageKickZoom: 0.4, imageDrift: 0.6, brightness: 0.8, react: 0.5 },
            overlays: { lasers: 0, smoke: 0, fire: 0 },
            spectrum: { style: 'radial-wave', layers: 6, radius: 0.15, height: 0.12, thickness: 0.003, colorMode: 'palette', kickScale: 0.7, echo: 0.5 },
            center: { enabled: true, radius: 0.15, ring: 0.3, ringGlow: 0.4, shockRings: 0.2 },
            particles: { mode: 'dust', count: 260, size: 0.5, speed: 0.4, kickBoost: 0.6, colorMode: 'white' },
            text: { font: 'Bebas Neue', size: 0.075, spacing: 0.08, glitch: 0, anim: 'bounce', animAmount: 0.3 },
            fx: { bloom: 0.6, shake: 0.3, zoomPunch: 0.35, chromatic: 0.15, glitch: 0, shockwave: 0.2, flash: 0.15, trails: 0, zoomBlur: 0.25 },
        },
    },
    {
        id: 'synthwave',
        name: 'Synthwave Drive',
        tags: 'synthwave · retro · electro',
        swatch: ['#ff2a6d', '#7700ff', '#05d9e8'],
        patch: {
            palette: { a: '#05d9e8', b: '#7700ff', c: '#ff2a6d', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'grid', speed: 0.45, scale: 0.4, detail: 0.2, twist: 0.2, brightness: 1, react: 0.5 },
            overlays: { lasers: 0, smoke: 0, fire: 0 },
            spectrum: { style: 'terrain', bars: 72, y: -0.45, width: 1.2, height: 0.18, thickness: 0.004, mirror: true, colorMode: 'palette', kickScale: 0.3 },
            center: { enabled: false },
            particles: { mode: 'dust', count: 150, size: 0.4, speed: 0.3, colorMode: 'palette' },
            text: { font: 'Monoton', y: 0.62, size: 0.06, spacing: 0.06, glitch: 0.1, glow: 0.7, color: '#ff2a6d', subColor: '#05d9e8', anim: 'flicker', animAmount: 0.7 },
            fx: { bloom: 0.75, flare: 0.45, shake: 0.2, zoomPunch: 0.25, chromatic: 0.35, glitch: 0.1, shockwave: 0, flash: 0.15, scanlines: 0.25, grain: 0.12, zoomBlur: 0.2 },
        },
    },
    {
        id: 'nebula',
        name: 'Liquid Nebula',
        tags: 'chill · ambient · melodic',
        swatch: ['#8e2de2', '#4a00e0', '#00d2ff'],
        patch: {
            palette: { a: '#00d2ff', b: '#4a00e0', c: '#8e2de2', hueSpeed: 0, dropHueShift: 20 },
            background: { mode: 'nebula', speed: 0.25, scale: 0.4, detail: 0.6, twist: 0.3, brightness: 1, react: 0.4 },
            overlays: { lasers: 0, smoke: 0, fire: 0 },
            spectrum: { style: 'oscilloscope', y: -0.35, width: 0.75, height: 0.1, thickness: 0.004, colorMode: 'palette', kickScale: 0.2 },
            center: { enabled: false },
            particles: { mode: 'dust', count: 220, size: 0.6, speed: 0.25, kickBoost: 0.3, colorMode: 'white' },
            text: { font: 'Syncopate', size: 0.04, spacing: 0.25, y: 0.12, glitch: 0, glow: 0.4, anim: 'wave', animAmount: 0.3 },
            fx: { bloom: 0.6, shake: 0.08, zoomPunch: 0.15, chromatic: 0.1, glitch: 0, shockwave: 0, flash: 0.08, trails: 0, grain: 0.06, dynamics: 0.3, dreamy: 0.6, zoomBlur: 0 },
        },
    },
    {
        id: 'minimal',
        name: 'Minimal Mono',
        tags: 'simple · mirrored bars',
        group: 'simple',
        swatch: ['#ffffff', '#9e9e9e', '#ffffff'],
        patch: {
            palette: { a: '#ffffff', b: '#8a8a8a', c: '#ffffff', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'void', brightness: 0.6, detail: 0.3 },
            overlays: { lasers: 0, smoke: 0, fire: 0 },
            spectrum: { style: 'linear-bars', bars: 64, y: -0.15, width: 0.7, height: 0.2, gap: 0.45, mirror: true, colorMode: 'mono', kickScale: 0.3 },
            center: { enabled: false },
            particles: { mode: 'none' },
            text: { font: 'Anton', y: 0.4, size: 0.08, spacing: 0.05, glitch: 0, glow: 0.2, anim: 'none' },
            fx: { bloom: 0.35, shake: 0.15, zoomPunch: 0.2, chromatic: 0, glitch: 0, shockwave: 0, flash: 0.1, trails: 0, grain: 0.05, vignette: 0.4, zoomBlur: 0 },
        },
    },

    // ---- popular styles: well-known looks from music channels and visualizer apps ----
    {
        id: 'bass-circle',
        name: 'Bass Circle',
        tags: 'popular · circle on cover art',
        group: 'popular',
        swatch: ['#ffffff', '#40c4ff', '#ff4081'],
        patch: {
            palette: { a: '#ffffff', b: '#40c4ff', c: '#ff4081', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'image', imageBlur: 0.35, imageDim: 0.45, imageKickZoom: 0.6, imageDrift: 0.3, brightness: 0.9, react: 0.6 },
            overlays: NO_OVERLAYS,
            spectrum: { style: 'radial-wave', layers: 5, radius: 0.16, height: 0.12, thickness: 0.003, mirror: true, colorMode: 'palette', kickScale: 0.8, echo: 0 },
            center: { enabled: true, shape: 'circle', x: 0, y: 0, radius: 0.16, ring: 0.35, ringGlow: 0.4, shockRings: 0.25, wobble: 0.1, kickScale: 0.7 },
            particles: { mode: 'dust', count: 220, size: 0.35, speed: 0.4, kickBoost: 0.9, opacity: 0.7, dropBurst: false },
            text: { ...CLEAN_TEXT, font: 'Bebas Neue', y: -0.74, size: 0.06, spacing: 0.08, pulse: 0.3 },
            fx: { ...CLEAN_FX, bloom: 0.5, shake: 0.55, zoomPunch: 0.35, chromatic: 0.12, flash: 0.08, zoomBlur: 0.15, vignette: 0.5, grain: 0.05, dynamics: 0.5 },
        },
    },
    {
        id: 'label-bars',
        name: 'Label Bars',
        tags: 'popular · smooth white bars',
        group: 'popular',
        swatch: ['#ffffff', '#90a4ae', '#ffffff'],
        patch: {
            palette: { a: '#ffffff', b: '#cfd8dc', c: '#ffffff', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'image', imageBlur: 0.5, imageDim: 0.55, imageKickZoom: 0.25, imageDrift: 0.25, brightness: 0.85, react: 0.4 },
            overlays: NO_OVERLAYS,
            spectrum: { style: 'linear-bars', bars: 63, x: 0, y: -0.05, width: 0.8, height: 0.3, thickness: 0.002, gap: 0.3, mirror: false, peaks: false, smooth: 0.75, colorMode: 'mono', kickScale: 0.1, echo: 0, release: 0.2 },
            center: { enabled: false },
            particles: { mode: 'dust', count: 140, size: 0.3, speed: 0.3, kickBoost: 0.4, opacity: 0.55, dropBurst: false },
            text: { ...CLEAN_TEXT, font: 'Bebas Neue', y: -0.32, size: 0.07, spacing: 0.04 },
            fx: { ...CLEAN_FX, bloom: 0.25, shake: 0.12 },
        },
    },
    {
        id: 'scifi-hud',
        name: 'Sci-Fi HUD',
        tags: 'popular · HUD circle',
        group: 'popular',
        swatch: ['#00e5ff', '#1de9b6', '#ff9100'],
        patch: {
            palette: { a: '#00e5ff', b: '#1de9b6', c: '#ff9100', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'hex', speed: 0.3, scale: 0.5, detail: 0.3, brightness: 0.35, react: 0.4 },
            overlays: NO_OVERLAYS,
            spectrum: { style: 'hud', bars: 96, radius: 0.15, height: 0.13, thickness: 0.003, mirror: true, colorMode: 'palette', kickScale: 0.3, echo: 0 },
            center: { enabled: true, shape: 'circle', x: 0, y: 0.02, radius: 0.12, ring: 0.2, ringGlow: 0.3, shockRings: 0, wobble: 0, kickScale: 0.3 },
            particles: { mode: 'dust', count: 120, size: 0.25, speed: 0.3, kickBoost: 0.4, opacity: 0.5, dropBurst: false },
            text: { ...CLEAN_TEXT, font: 'Orbitron', y: -0.8, size: 0.045, spacing: 0.22, glow: 0.45, anim: 'flicker', animAmount: 0.25 },
            fx: { ...CLEAN_FX, bloom: 0.6, chromatic: 0.12, scanlines: 0.2, glitch: 0.06, shake: 0.1, grain: 0.05, vignette: 0.55 },
        },
    },
    {
        id: 'liquid-orb',
        name: 'Liquid Orb',
        tags: 'popular · organic blob',
        group: 'popular',
        swatch: ['#b388ff', '#ff4081', '#18ffff'],
        patch: {
            palette: { a: '#b388ff', b: '#ff4081', c: '#18ffff', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'gradient', speed: 0.3, scale: 0.7, detail: 0.3, brightness: 0.55, react: 0.3 },
            overlays: NO_OVERLAYS,
            spectrum: { style: 'blob', radius: 0.16, height: 0.1, layers: 3, mirror: true, colorMode: 'palette', kickScale: 0.3, echo: 0 },
            center: { enabled: false, x: 0, y: 0.06 },
            particles: { mode: 'none' },
            text: { ...CLEAN_TEXT, font: 'Bebas Neue', y: -0.78, size: 0.055, spacing: 0.1 },
            fx: { ...CLEAN_FX, bloom: 0.5, zoomPunch: 0.1, vignette: 0.45 },
        },
    },
    {
        id: 'particle-sphere',
        name: 'Particle Sphere',
        tags: 'popular · 3D sphere',
        group: 'popular',
        swatch: ['#00e5ff', '#2979ff', '#e040fb'],
        patch: {
            palette: { a: '#00e5ff', b: '#2979ff', c: '#e040fb', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'void', brightness: 0.5, detail: 0.2, react: 0.4 },
            overlays: NO_OVERLAYS,
            spectrum: { style: 'none', radius: 0.15 },
            center: { enabled: false, x: 0, y: 0.05 },
            particles: { mode: 'sphere', count: 1800, size: 0.4, speed: 0.4, kickBoost: 0.6, opacity: 0.9, colorMode: 'palette', dropBurst: true },
            text: { ...CLEAN_TEXT, font: 'Michroma', y: -0.82, size: 0.04, spacing: 0.22 },
            fx: { ...CLEAN_FX, bloom: 0.6, trails: 0, zoomPunch: 0.15, vignette: 0.5 },
        },
    },
    {
        id: 'retro-vhs',
        name: 'Retro VHS',
        tags: 'popular · lo-fi tape',
        group: 'popular',
        swatch: ['#ff8a65', '#ffd180', '#80deea'],
        patch: {
            palette: { a: '#ff8a65', b: '#ffd180', c: '#80deea', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'gradient', speed: 0.25, scale: 0.7, detail: 0.4, brightness: 0.8, react: 0.3 },
            overlays: NO_OVERLAYS,
            spectrum: { style: 'linear-bars', bars: 48, x: 0, y: -0.8, width: 0.6, height: 0.14, gap: 0.4, mirror: true, peaks: false, smooth: 0.4, colorMode: 'palette', kickScale: 0.15, echo: 0 },
            center: { enabled: true, shape: 'square', x: 0, y: 0.18, radius: 0.17, ring: 0, ringGlow: 0.15, shockRings: 0, wobble: 0, kickScale: 0.15 },
            particles: { mode: 'dust', count: 80, size: 0.3, speed: 0.2, kickBoost: 0.2, opacity: 0.4, dropBurst: false },
            text: { ...CLEAN_TEXT, font: 'Teko', y: -0.42, size: 0.06, spacing: 0.06 },
            fx: { ...CLEAN_FX, vhs: 0.65, bloom: 0.35, grain: 0.1, vignette: 0.6, saturation: 0.9, contrast: 1.05 },
        },
    },
    {
        id: 'feedback-trip',
        name: 'Feedback Trip',
        tags: 'popular · psychedelic',
        group: 'popular',
        swatch: ['#ff00aa', '#00e5ff', '#ffea00'],
        patch: {
            palette: { a: '#ff00aa', b: '#00e5ff', c: '#ffea00', hueSpeed: 12, dropHueShift: 60 },
            background: { mode: 'void', brightness: 0.3, detail: 0.2, react: 0.3 },
            overlays: NO_OVERLAYS,
            spectrum: { style: 'circle-scope', radius: 0.12, height: 0.12, thickness: 0.004, colorMode: 'rainbow', kickScale: 0.5, echo: 0 },
            center: { enabled: false, x: 0, y: 0 },
            particles: { mode: 'none' },
            text: { ...CLEAN_TEXT, font: 'Monoton', y: -0.8, size: 0.05, spacing: 0.1, anim: 'wave', animAmount: 0.4 },
            fx: { ...CLEAN_FX, trails: 0.95, trailZoom: 0.7, trailSpin: 0.35, bloom: 0.55, zoomPunch: 0.15, saturation: 1.25, vignette: 0.5 },
        },
    },

    // ---- simple looks: one clean visual, calm effects, any genre ----
    {
        id: 'clean-bars',
        name: 'Clean Bars',
        tags: 'simple · cover art + bars',
        group: 'simple',
        swatch: ['#4fc3f7', '#ffffff', '#b388ff'],
        patch: {
            palette: { a: '#4fc3f7', b: '#e3f2fd', c: '#b388ff', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'gradient', speed: 0.3, scale: 0.6, detail: 0.3, brightness: 0.9, react: 0.4 },
            overlays: NO_OVERLAYS,
            spectrum: { style: 'linear-bars', bars: 64, x: 0, y: -0.8, width: 0.78, height: 0.19, gap: 0.35, mirror: true, peaks: true, colorMode: 'palette', kickScale: 0.2, echo: 0 },
            center: { enabled: true, shape: 'square', x: 0, y: 0.22, radius: 0.15, ring: 0.12, ringGlow: 0.2, shockRings: 0, wobble: 0, kickScale: 0.2, spin: 0 },
            particles: { mode: 'dust', count: 90, size: 0.3, speed: 0.25, kickBoost: 0.2, opacity: 0.45, dropBurst: false },
            text: { ...CLEAN_TEXT, font: 'Bebas Neue', y: -0.34, size: 0.05, spacing: 0.08 },
            fx: CLEAN_FX,
        },
    },
    {
        id: 'audiogram',
        name: 'Audiogram',
        tags: 'simple · centre bars',
        group: 'simple',
        swatch: ['#18ffff', '#2979ff', '#d500f9'],
        patch: {
            palette: { a: '#18ffff', b: '#2979ff', c: '#d500f9', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'gradient', speed: 0.25, scale: 0.7, detail: 0.2, brightness: 0.85, react: 0.35 },
            overlays: NO_OVERLAYS,
            spectrum: { style: 'center-bars', bars: 56, x: 0, y: -0.12, width: 0.8, height: 0.32, gap: 0.45, mirror: true, colorMode: 'palette', kickScale: 0.2, echo: 0 },
            center: { enabled: false },
            particles: { mode: 'none' },
            text: { ...CLEAN_TEXT, font: 'Bebas Neue', y: 0.56, size: 0.07, spacing: 0.06 },
            fx: CLEAN_FX,
        },
    },
    {
        id: 'led',
        name: 'Hi-Fi LED',
        tags: 'simple · LED equalizer',
        group: 'simple',
        swatch: ['#00e676', '#ffea00', '#ff1744'],
        patch: {
            palette: { a: '#00e676', b: '#ffea00', c: '#ff1744', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'void', brightness: 0.45, detail: 0.2, react: 0.3 },
            overlays: NO_OVERLAYS,
            spectrum: { style: 'blocks', bars: 28, x: 0, y: -0.62, width: 0.74, height: 0.3, gap: 0.22, mirror: false, peaks: true, colorMode: 'palette', kickScale: 0, echo: 0, release: 0.12 },
            center: { enabled: false },
            particles: { mode: 'none' },
            text: { ...CLEAN_TEXT, font: 'Michroma', y: 0.62, size: 0.045, spacing: 0.18 },
            fx: { ...CLEAN_FX, bloom: 0.4 },
        },
    },
    {
        id: 'dot-matrix',
        name: 'Dot Matrix',
        tags: 'simple · dots',
        group: 'simple',
        swatch: ['#ff6e40', '#ff4081', '#ffd740'],
        patch: {
            palette: { a: '#ff6e40', b: '#ff4081', c: '#ffd740', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'gradient', speed: 0.2, scale: 0.8, detail: 0.25, brightness: 0.75, react: 0.35 },
            overlays: NO_OVERLAYS,
            spectrum: { style: 'dots', bars: 40, x: 0, y: -0.05, width: 0.8, height: 0.42, gap: 0.3, mirror: true, peaks: false, colorMode: 'palette', kickScale: 0.15, echo: 0 },
            center: { enabled: false },
            particles: { mode: 'none' },
            text: { ...CLEAN_TEXT, font: 'Anton', y: 0.72, size: 0.055, spacing: 0.08 },
            fx: CLEAN_FX,
        },
    },
    {
        id: 'thin-line',
        name: 'Thin Line',
        tags: 'simple · line spectrum',
        group: 'simple',
        swatch: ['#ffffff', '#64ffda', '#82b1ff'],
        patch: {
            palette: { a: '#64ffda', b: '#ffffff', c: '#82b1ff', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'void', brightness: 0.55, detail: 0.2, react: 0.3 },
            overlays: NO_OVERLAYS,
            spectrum: { style: 'line', bars: 96, x: 0, y: -0.4, width: 0.86, height: 0.3, thickness: 0.003, mirror: false, colorMode: 'palette', kickScale: 0.15, echo: 0 },
            center: { enabled: false },
            particles: { mode: 'none' },
            text: { ...CLEAN_TEXT, font: 'Michroma', y: 0.5, size: 0.04, spacing: 0.2 },
            fx: { ...CLEAN_FX, bloom: 0.45 },
        },
    },
];

/** Applies a preset while keeping track text, images, sync and export settings. */
export function applyPreset(current: Project, preset: Preset): Project {
    const fresh = deepMerge(createDefaultProject(), preset.patch) as Project;
    fresh.name = current.name;
    fresh.meta = { ...current.meta };
    fresh.sync = { ...current.sync };
    fresh.export = { ...current.export };
    fresh.background.imageId = current.background.imageId;
    fresh.center.imageId = current.center.imageId;
    fresh.watermark = { ...current.watermark };
    fresh.lyrics = { ...current.lyrics, cues: current.lyrics.cues };
    fresh.text.intro = current.text.intro;
    return fresh;
}

const RANDOM_PALETTES: [string, string, string][] = [
    ['#00e5ff', '#7a2cff', '#ff2bd6'],
    ['#ff5a00', '#ff0033', '#ffc400'],
    ['#ff0022', '#ffffff', '#7a0010'],
    ['#39ff14', '#ff00aa', '#fff200'],
    ['#ffb300', '#ffe2a0', '#2979ff'],
    ['#2af5ff', '#3d5afe', '#e0f7ff'],
    ['#05d9e8', '#7700ff', '#ff2a6d'],
    ['#f72585', '#7209b7', '#4cc9f0'],
    ['#00ff9c', '#00b8ff', '#d600ff'],
    ['#ff7b00', '#ff0054', '#ffffff'],
];

/** A random preset with a random palette and a few nudged parameters. */
export function surprise(current: Project): Project {
    const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const p = applyPreset(current, pick(PRESETS));
    const pal = pick(RANDOM_PALETTES);
    p.palette.a = pal[0];
    p.palette.b = pal[1];
    p.palette.c = pal[2];
    const jitter = (v: number, amt = 0.25) => Math.min(1, Math.max(0, v + (Math.random() - 0.5) * amt));
    p.background.speed = jitter(p.background.speed);
    p.background.scale = jitter(p.background.scale);
    p.background.detail = jitter(p.background.detail, 0.5);
    p.background.twist = jitter(p.background.twist, 0.5);
    p.fx.shake = jitter(p.fx.shake, 0.2);
    return p;
}

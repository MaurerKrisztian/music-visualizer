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
    patch: DeepPartial<Project>;
}

export const PRESETS: Preset[] = [
    {
        id: 'euphoric',
        name: 'Euphoric Hardstyle',
        tags: 'hardstyle · euphoric · festival',
        swatch: ['#00e5ff', '#7a2cff', '#ff2bd6'],
        patch: {
            palette: { a: '#00e5ff', b: '#7a2cff', c: '#ff2bd6', hueSpeed: 0, dropHueShift: 40 },
            background: { mode: 'tunnel', speed: 0.45, scale: 0.45, detail: 0.5, twist: 0.3, brightness: 0.75, react: 0.7 },
            overlays: { lasers: 0.4, smoke: 0.3, fire: 0 },
            spectrum: { style: 'radial-bars', bars: 64, radius: 0.15, height: 0.15, gap: 0.35, colorMode: 'palette', kickScale: 0.6 },
            center: { enabled: true, radius: 0.15, ring: 0.6, ringGlow: 0.7, shockRings: 0.6 },
            particles: { mode: 'warp', count: 320, size: 0.4, speed: 0.5, kickBoost: 0.7, colorMode: 'palette' },
            text: { font: 'Orbitron', glitch: 0.25, glow: 0.5 },
            fx: { bloom: 0.75, shake: 0.4, zoomPunch: 0.45, chromatic: 0.3, glitch: 0.2, shockwave: 0.4, flash: 0.35, trails: 0.1, grain: 0.1 },
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
            overlays: { fire: 0.85, fireHeight: 0.28, smoke: 0.35, lasers: 0 },
            spectrum: { style: 'radial-wave', layers: 3, radius: 0.15, height: 0.13, colorMode: 'palette', kickScale: 0.8 },
            center: { enabled: true, radius: 0.15, ring: 0.8, ringGlow: 0.9, shockRings: 0.9 },
            particles: { mode: 'embers', count: 450, size: 0.45, speed: 0.6, kickBoost: 0.9, colorMode: 'fire' },
            text: { font: 'Black Ops One', glitch: 0.5, glow: 0.45, color: '#ffffff', subColor: '#ffb199' },
            fx: { bloom: 0.75, shake: 0.75, zoomPunch: 0.6, chromatic: 0.5, glitch: 0.45, shockwave: 0.65, flash: 0.35, grain: 0.22, contrast: 1.15, vignette: 0.7, trails: 0.1 },
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
            overlays: { lasers: 0, smoke: 0.2, fire: 0 },
            spectrum: { style: 'radial-bars', bars: 48, radius: 0.14, height: 0.17, gap: 0.2, colorMode: 'reactive', kickScale: 1 },
            center: { enabled: true, radius: 0.14, ring: 1, ringGlow: 0.6, shockRings: 1 },
            particles: { mode: 'sparks', count: 500, size: 0.35, speed: 0.8, kickBoost: 1, colorMode: 'white' },
            text: { font: 'UnifrakturMaguntia', uppercase: false, spacing: 0.04, size: 0.065, glitch: 0.8, glow: 0.35, color: '#ffffff', subColor: '#ff4d5e' },
            fx: { bloom: 0.6, bloomThreshold: 0.6, shake: 0.9, zoomPunch: 0.7, chromatic: 0.75, glitch: 0.8, shockwave: 0.8, flash: 0.45, strobe: 0.25, scanlines: 0.35, grain: 0.35, contrast: 1.25, saturation: 0.95, vignette: 0.75, dynamics: 0.5 },
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
            spectrum: { style: 'circle-scope', radius: 0.15, height: 0.16, thickness: 0.006, colorMode: 'rainbow', kickScale: 0.8 },
            center: { enabled: true, radius: 0.14, ring: 0.5, ringGlow: 0.8, shockRings: 0.8, spin: 0.3 },
            particles: { mode: 'warp', count: 260, size: 0.3, speed: 0.8, kickBoost: 1, colorMode: 'palette' },
            text: { font: 'Rubik Glitch', glitch: 0.7, glow: 0.6 },
            fx: { bloom: 0.6, bloomThreshold: 0.65, shake: 0.7, zoomPunch: 0.6, chromatic: 0.6, glitch: 0.6, shockwave: 0.6, flash: 0.25, trails: 0.45, trailZoom: 0.6, trailSpin: 0.25, grain: 0.15 },
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
            spectrum: { style: 'linear-bars', bars: 48, y: -0.5, width: 0.8, height: 0.22, gap: 0.3, mirror: true, colorMode: 'palette', kickScale: 0.5 },
            center: { enabled: false },
            particles: { mode: 'none' },
            text: { font: 'Bungee', y: 0.55, size: 0.07, glitch: 0.4, glow: 0.4, color: '#ffe600', subColor: '#ffffff' },
            fx: { bloom: 0.6, shake: 0.6, zoomPunch: 0.5, chromatic: 0.55, glitch: 0.35, shockwave: 0.2, flash: 0.3, scanlines: 0.55, grain: 0.3, contrast: 1.1, vignette: 0.6 },
        },
    },
    {
        id: 'mainstage',
        name: 'Mainstage Pyro',
        tags: 'hardstyle · festival · anthem',
        swatch: ['#ffb300', '#ffffff', '#2979ff'],
        patch: {
            palette: { a: '#ffb300', b: '#ffffff', c: '#2979ff', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'lasers', speed: 0.5, scale: 0.5, detail: 0.55, twist: 0.6, brightness: 0.9, react: 0.7 },
            overlays: { fire: 0.7, fireHeight: 0.22, smoke: 0.45, lasers: 0 },
            spectrum: { style: 'radial-wave', layers: 4, radius: 0.15, height: 0.12, colorMode: 'palette', kickScale: 0.6 },
            center: { enabled: true, radius: 0.15, ring: 0.5, ringGlow: 0.8, shockRings: 0.5 },
            particles: { mode: 'sparks', count: 400, size: 0.4, speed: 0.6, kickBoost: 0.8, colorMode: 'fire' },
            text: { font: 'Michroma', spacing: 0.18, size: 0.045, glitch: 0.1, glow: 0.55 },
            fx: { bloom: 0.9, shake: 0.4, zoomPunch: 0.4, chromatic: 0.2, glitch: 0.1, shockwave: 0.35, flash: 0.45, grain: 0.08, trails: 0 },
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
            spectrum: { style: 'radial-bars', bars: 90, radius: 0.16, height: 0.12, gap: 0.45, colorMode: 'palette', kickScale: 0.5 },
            center: { enabled: true, radius: 0.16, ring: 0.4, ringGlow: 0.6, shockRings: 0.4 },
            particles: { mode: 'none' },
            text: { font: 'Audiowide', glitch: 0.15 },
            fx: { bloom: 0.8, shake: 0.3, zoomPunch: 0.4, chromatic: 0.4, glitch: 0.1, shockwave: 0.3, flash: 0.25, trails: 0.5, trailZoom: 0.5 },
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
            center: { enabled: true, radius: 0.16, ring: 0.5, ringGlow: 0.5, shockRings: 0.4 },
            particles: { mode: 'dust', count: 220, size: 0.5, speed: 0.4, kickBoost: 0.5, colorMode: 'white' },
            text: { font: 'Bebas Neue', size: 0.07, spacing: 0.1, glitch: 0.15 },
            fx: { bloom: 0.55, bloomThreshold: 0.7, shake: 0.35, zoomPunch: 0.45, chromatic: 0.25, glitch: 0.1, shockwave: 0.3, flash: 0.2, grain: 0.08, trails: 0 },
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
            spectrum: { style: 'radial-wave', layers: 6, radius: 0.15, height: 0.12, thickness: 0.003, colorMode: 'palette', kickScale: 0.7 },
            center: { enabled: true, radius: 0.15, ring: 0.3, ringGlow: 0.4, shockRings: 0.2 },
            particles: { mode: 'dust', count: 260, size: 0.5, speed: 0.4, kickBoost: 0.6, colorMode: 'white' },
            text: { font: 'Bebas Neue', size: 0.075, spacing: 0.08, glitch: 0 },
            fx: { bloom: 0.6, shake: 0.3, zoomPunch: 0.35, chromatic: 0.15, glitch: 0, shockwave: 0.2, flash: 0.15, trails: 0 },
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
            spectrum: { style: 'linear-wave', layers: 3, y: -0.5, width: 0.9, height: 0.12, mirror: true, colorMode: 'palette', kickScale: 0.4 },
            center: { enabled: false },
            particles: { mode: 'dust', count: 150, size: 0.4, speed: 0.3, colorMode: 'palette' },
            text: { font: 'Monoton', y: 0.62, size: 0.06, spacing: 0.06, glitch: 0.1, glow: 0.7, color: '#ff2a6d', subColor: '#05d9e8' },
            fx: { bloom: 0.75, shake: 0.2, zoomPunch: 0.25, chromatic: 0.35, glitch: 0.1, shockwave: 0, flash: 0.15, scanlines: 0.25, grain: 0.12 },
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
            text: { font: 'Syncopate', size: 0.04, spacing: 0.25, y: 0.12, glitch: 0, glow: 0.4 },
            fx: { bloom: 0.6, shake: 0.08, zoomPunch: 0.15, chromatic: 0.1, glitch: 0, shockwave: 0, flash: 0.08, trails: 0, grain: 0.06, dynamics: 0.3 },
        },
    },
    {
        id: 'minimal',
        name: 'Minimal Mono',
        tags: 'any genre · clean',
        swatch: ['#ffffff', '#9e9e9e', '#ffffff'],
        patch: {
            palette: { a: '#ffffff', b: '#8a8a8a', c: '#ffffff', hueSpeed: 0, dropHueShift: 0 },
            background: { mode: 'void', brightness: 0.6, detail: 0.3 },
            overlays: { lasers: 0, smoke: 0, fire: 0 },
            spectrum: { style: 'linear-bars', bars: 64, y: -0.15, width: 0.7, height: 0.2, gap: 0.45, mirror: true, colorMode: 'mono', kickScale: 0.3 },
            center: { enabled: false },
            particles: { mode: 'none' },
            text: { font: 'Anton', y: 0.4, size: 0.08, spacing: 0.05, glitch: 0, glow: 0.2 },
            fx: { bloom: 0.35, shake: 0.15, zoomPunch: 0.2, chromatic: 0, glitch: 0, shockwave: 0, flash: 0.1, trails: 0, grain: 0.05, vignette: 0.4 },
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
    fresh.text.intro = current.text.intro;
    return fresh;
}

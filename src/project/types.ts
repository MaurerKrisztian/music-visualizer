// The project is one plain, serialisable object. The UI edits it, the engine
// reads it every frame, and save/load just (de)serialises it.

export const BACKGROUND_MODES = ['image', 'tunnel', 'warp', 'lasers', 'hex', 'grid', 'nebula', 'plasma', 'kaleido', 'void'] as const;
export type BackgroundMode = (typeof BACKGROUND_MODES)[number];

export const SPECTRUM_STYLES = ['radial-bars', 'radial-wave', 'linear-bars', 'linear-wave', 'oscilloscope', 'circle-scope', 'none'] as const;
export type SpectrumStyle = (typeof SPECTRUM_STYLES)[number];

export const PARTICLE_MODES = ['none', 'warp', 'embers', 'dust', 'sparks'] as const;
export type ParticleMode = (typeof PARTICLE_MODES)[number];

export const COLOR_MODES = ['palette', 'reactive', 'rainbow', 'mono'] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export interface Project {
    version: 2;
    name: string;
    meta: {
        artist: string;
        title: string;
    };
    sync: {
        /** 0..1 kick detector sensitivity */
        sensitivity: number;
        bpmOverride: number | null;
        beatOffsetMs: number;
        /** seconds */
        kickDecay: number;
        /** extra visual delay in the live preview, ms (negative = earlier) */
        previewOffsetMs: number;
    };
    palette: {
        a: string;
        b: string;
        c: string;
        /** degrees per second */
        hueSpeed: number;
        /** degrees added at every detected drop */
        dropHueShift: number;
        /** blend to a separate palette when the music is intense (drops) */
        dropColors: boolean;
        da: string;
        db: string;
        dc: string;
    };
    background: {
        mode: BackgroundMode;
        imageId: string | null;
        imageBlur: number;
        imageDim: number;
        /** zoom punch of the image on kicks */
        imageKickZoom: number;
        /** slow Ken Burns drift */
        imageDrift: number;
        /** 0 = off, else number of kaleidoscope segments */
        imageKaleido: number;
        speed: number;
        scale: number;
        detail: number;
        twist: number;
        brightness: number;
        /** how much energy/kicks drive the motion */
        react: number;
    };
    overlays: {
        fire: number;
        lasers: number;
        smoke: number;
        /** base flame height 0..1 */
        fireHeight: number;
        /** festival crowd silhouettes in the foreground */
        crowd: number;
        crowdHeight: number;
    };
    spectrum: {
        style: SpectrumStyle;
        bars: number;
        x: number;
        y: number;
        radius: number;
        height: number;
        width: number;
        thickness: number;
        gap: number;
        layers: number;
        mirror: boolean;
        rotate: number;
        kickScale: number;
        colorMode: ColorMode;
        opacity: number;
        release: number;
        minHz: number;
        maxHz: number;
        gainDb: number;
        rangeDb: number;
        tiltDb: number;
    };
    center: {
        enabled: boolean;
        imageId: string | null;
        x: number;
        y: number;
        radius: number;
        kickScale: number;
        ring: number;
        ringGlow: number;
        spin: number;
        shockRings: number;
    };
    particles: {
        mode: ParticleMode;
        count: number;
        size: number;
        speed: number;
        kickBoost: number;
        opacity: number;
        colorMode: 'palette' | 'white' | 'fire';
    };
    text: {
        enabled: boolean;
        font: string;
        x: number;
        y: number;
        size: number;
        subSize: number;
        spacing: number;
        uppercase: boolean;
        color: string;
        subColor: string;
        stroke: number;
        strokeColor: string;
        glow: number;
        pulse: number;
        glitch: number;
        align: 'left' | 'center' | 'right';
        /** seconds the title is shown big in the centre at the start (0 = off) */
        intro: number;
    };
    lyrics: {
        cues: { start: number; end: number; text: string }[];
        y: number;
        size: number;
        color: string;
        glow: number;
        uppercase: boolean;
    };
    watermark: {
        imageId: string | null;
        corner: 'tl' | 'tr' | 'bl' | 'br';
        size: number;
        margin: number;
        opacity: number;
        pulse: number;
    };
    fx: {
        bloom: number;
        bloomThreshold: number;
        bloomRadius: number;
        shake: number;
        zoomPunch: number;
        chromatic: number;
        glitch: number;
        shockwave: number;
        flash: number;
        strobe: number;
        trails: number;
        trailZoom: number;
        trailSpin: number;
        vignette: number;
        grain: number;
        scanlines: number;
        exposure: number;
        contrast: number;
        saturation: number;
        letterbox: number;
        /** 0..1 how much calmer breakdowns are than drops */
        dynamics: number;
        /** extra shake / zoom ramp during build-ups */
        buildBoost: number;
        /** beat-synced camera cuts (new angle every bar) in intense parts */
        cuts: number;
        fadeIn: number;
        fadeOut: number;
    };
    progress: {
        enabled: boolean;
        y: number;
        thickness: number;
        color: string;
        glow: number;
    };
    export: {
        resolution: string;
        fps: number;
        format: 'mp4' | 'webm';
        quality: 'standard' | 'high' | 'max';
        rangeStart: number | null;
        rangeEnd: number | null;
        audioFadeOut: number;
    };
}

export const RESOLUTIONS: Record<string, { w: number; h: number; label: string }> = {
    '720p': { w: 1280, h: 720, label: '720p HD (16:9)' },
    '1080p': { w: 1920, h: 1080, label: '1080p Full HD (16:9)' },
    '1440p': { w: 2560, h: 1440, label: '1440p QHD (16:9)' },
    '2160p': { w: 3840, h: 2160, label: '4K UHD (16:9)' },
    'short': { w: 1080, h: 1920, label: 'Shorts / TikTok / Reels (9:16)' },
    'square': { w: 1080, h: 1080, label: 'Square (1:1)' },
    'portrait': { w: 1080, h: 1350, label: 'Instagram portrait (4:5)' },
};

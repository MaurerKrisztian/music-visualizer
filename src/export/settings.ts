// Export settings, size estimates and helpers (kept free of heavy imports so the
// UI can use them without loading the encoder).

import type { Envelopes, Interpretation } from '../audio/analysis';
import type { ReactOptions } from '../audio/features';
import type { EngineImages } from '../engine/engine';

export interface ExportSettings {
    width: number;
    height: number;
    fps: number;
    format: 'mp4' | 'webm';
    quality: 'standard' | 'high' | 'max';
    start: number;
    end: number;
    audioFadeOut: number;
    fileName: string;
    /** Writable stream from the File System Access API (streams to disk). */
    writable?: FileSystemWritableFileStream;
}

export interface ExportProgress {
    stage: 'preparing' | 'rendering' | 'finalizing' | 'done';
    frame: number;
    totalFrames: number;
    renderFps: number;
    etaSeconds: number;
    bytes: number;
}

export interface ExportResult {
    blob: Blob | null;
    fileName: string;
    savedToDisk: boolean;
    videoCodec: string;
    audioCodec: string;
    bytes: number;
    seconds: number;
}

export interface ExportDeps {
    buffer: AudioBuffer;
    env: Envelopes;
    interp: Interpretation;
    images: EngineImages;
    react: ReactOptions;
    fontWeight: (family: string) => string;
    fontsVersion: () => number;
    /** Optional canvas to mirror frames into (preview in the export dialog). */
    previewCanvas?: HTMLCanvasElement | null;
}

/** Offline export needs video WebCodecs; audio can fall back to the WASM AAC encoder. */
export function supportsWebCodecs(): boolean {
    return typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;
}

const BPP: Record<ExportSettings['quality'], number> = { standard: 0.1, high: 0.16, max: 0.25 };

export function targetBitrate(s: Pick<ExportSettings, 'width' | 'height' | 'fps' | 'quality'>): number {
    const raw = s.width * s.height * s.fps * BPP[s.quality];
    return Math.round(Math.min(120e6, Math.max(4e6, raw)));
}

export function estimateBytes(s: Pick<ExportSettings, 'width' | 'height' | 'fps' | 'quality'>, seconds: number, format: 'mp4' | 'webm'): number {
    const audio = format === 'mp4' ? 320_000 : 256_000;
    return ((targetBitrate(s) + audio) * seconds) / 8;
}

// ---------------------------------------------------------------------------
// Saving files. On a normal site a plain <a download> works. Inside a Claude
// artifact viewer, page-started downloads are blocked and files go through
// the viewer's `downloads` capability instead (the viewer confirms the save).
// ---------------------------------------------------------------------------

interface DownloadsApi {
    save(req: { filename: string; data: Blob }): Promise<{ status: string }>;
}

type ClaudeHost = { use?: (name: string) => Promise<unknown> };

function claudeHost(): ClaudeHost | null {
    const c = (window as unknown as { claude?: ClaudeHost }).claude;
    return c && typeof c.use === 'function' ? c : null;
}

/** True when the page runs inside a Claude artifact viewer. */
export function isArtifactView(): boolean {
    return claudeHost() !== null;
}

/** True when the page is framed (no File System Access save picker there). */
export function isFramed(): boolean {
    try {
        return window.self !== window.top;
    } catch {
        return true;
    }
}

let downloadsPromise: Promise<DownloadsApi | null> | null = null;

/** Starts resolving the downloads capability early so saves don't wait. */
export function prepareDownloads(): Promise<DownloadsApi | null> {
    const host = claudeHost();
    if (!host) return Promise.resolve(null);
    if (!downloadsPromise) downloadsPromise = (host.use!('downloads') as Promise<DownloadsApi | null>).catch(() => null);
    return downloadsPromise;
}

export type SaveOutcome = { ok: true } | { ok: false; declined: boolean; message: string };

/** Offers a generated file to the viewer. Never throws. */
export async function saveFile(blob: Blob, fileName: string): Promise<SaveOutcome> {
    if (isArtifactView()) {
        const downloads = await prepareDownloads();
        if (!downloads) return { ok: false, declined: false, message: 'Saving files is not available in this view. Open the artifact in a browser on a computer to save it.' };
        try {
            await downloads.save({ filename: fileName, data: blob });
            return { ok: true };
        } catch (err) {
            const code = (err as { code?: string })?.code ?? 'unavailable';
            if (code === 'declined') return { ok: false, declined: true, message: 'Save cancelled.' };
            if (code === 'rate_limited') return { ok: false, declined: false, message: 'Another save is still waiting for confirmation. Try again in a moment.' };
            if (code === 'host_unavailable') return { ok: false, declined: false, message: 'This app cannot save files. Open the artifact in a browser or on a computer to save it.' };
            if (code === 'too_large') return { ok: false, declined: false, message: 'The file is too large to save here. Try a shorter range or a lower resolution.' };
            return { ok: false, declined: false, message: `The file could not be saved (${code}).` };
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { ok: true };
}

export function safeFileName(s: string): string {
    return (s || 'canvasbeats').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'canvasbeats';
}

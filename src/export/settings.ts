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

export function supportsWebCodecs(): boolean {
    return typeof window !== 'undefined' && 'VideoEncoder' in window && 'AudioEncoder' in window && 'VideoFrame' in window;
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

export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function safeFileName(s: string): string {
    return (s || 'canvasbeats').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'canvasbeats';
}

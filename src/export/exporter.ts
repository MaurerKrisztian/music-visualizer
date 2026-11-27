// Offline, frame-accurate video export. Frames are rendered one by one at
// exact timestamps (independent of real time), encoded with WebCodecs and
// muxed with mediabunny. Result: smooth 60 fps MP4 (H.264 + AAC) or WebM
// (VP9 + Opus), ready for YouTube.

import {
    AudioBufferSource,
    BufferTarget,
    canEncodeAudio,
    canEncodeVideo,
    CanvasSource,
    Mp4OutputFormat,
    Output,
    Quality,
    StreamTarget,
    WebMOutputFormat,
    type AudioCodec,
    type VideoCodec,
} from 'mediabunny';
import { FeatureExtractor } from '../audio/features';
import { Engine } from '../engine/engine';
import type { Project } from '../project/types';
import { supportsWebCodecs, targetBitrate, type ExportDeps, type ExportProgress, type ExportResult, type ExportSettings } from './settings';

export type { ExportDeps, ExportProgress, ExportResult, ExportSettings } from './settings';

export class ExportCancelled extends Error {
    constructor() {
        super('Export cancelled');
    }
}

async function pickCodecs(s: ExportSettings, bitrate: number): Promise<{ video: VideoCodec; audio: AudioCodec }> {
    const vCandidates: VideoCodec[] = s.format === 'mp4' ? ['avc', 'hevc', 'vp9', 'av1'] : ['vp9', 'vp8', 'av1'];
    let video: VideoCodec | null = null;
    for (const c of vCandidates) {
        if (await canEncodeVideo(c, { width: s.width, height: s.height, bitrate })) {
            video = c;
            break;
        }
    }
    if (!video) throw new Error(`This browser cannot encode ${s.width}x${s.height} video in ${s.format.toUpperCase()}. Try a lower resolution or the other format.`);

    let audio: AudioCodec;
    if (s.format === 'mp4') {
        if (await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 48000, bitrate: 320_000 })) {
            audio = 'aac';
        } else {
            // Linux / Firefox: no native AAC encoder, use the WASM one.
            const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
            registerAacEncoder();
            audio = 'aac';
        }
    } else {
        audio = 'opus';
        if (!(await canEncodeAudio('opus', { numberOfChannels: 2, sampleRate: 48000 }))) throw new Error('This browser cannot encode Opus audio. Try MP4.');
    }
    return { video, audio };
}

function sliceAudio(buffer: AudioBuffer, start: number, end: number, fadeOut: number): AudioBuffer {
    const sr = buffer.sampleRate;
    const s0 = Math.max(0, Math.floor(start * sr));
    const s1 = Math.min(buffer.length, Math.ceil(end * sr));
    const len = Math.max(1, s1 - s0);
    const out = new AudioBuffer({ numberOfChannels: Math.min(2, buffer.numberOfChannels) || 1, length: len, sampleRate: sr });
    const fadeInN = s0 > 0 ? Math.min(len, Math.round(0.01 * sr)) : 0;
    const fadeN = Math.min(len, Math.round(Math.max(fadeOut, s1 < buffer.length ? 0.03 : 0) * sr));
    for (let c = 0; c < out.numberOfChannels; c++) {
        const src = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1)).subarray(s0, s1);
        const dst = out.getChannelData(c);
        dst.set(src);
        for (let i = 0; i < fadeInN; i++) dst[i] *= i / fadeInN;
        for (let i = 0; i < fadeN; i++) dst[len - 1 - i] *= i / fadeN;
    }
    return out;
}

function audioChunk(full: AudioBuffer, from: number, to: number): AudioBuffer {
    const sr = full.sampleRate;
    const a = Math.min(full.length, Math.round(from * sr));
    const b = Math.min(full.length, Math.round(to * sr));
    const out = new AudioBuffer({ numberOfChannels: full.numberOfChannels, length: Math.max(1, b - a), sampleRate: sr });
    for (let c = 0; c < full.numberOfChannels; c++) out.getChannelData(c).set(full.getChannelData(c).subarray(a, Math.max(a + 1, b)));
    return out;
}

// MessageChannel yields are not throttled like timers in background tabs, so
// an export keeps full speed when the user switches tabs.
const channel = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
const yieldToUi = () =>
    new Promise<void>((resolve) => {
        if (!channel) return void setTimeout(resolve, 0);
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(0);
    });

type WakeLockLike = { release: () => Promise<void> };
async function requestWakeLock(): Promise<WakeLockLike | null> {
    try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock;
        return wl ? await wl.request('screen') : null;
    } catch {
        return null;
    }
}

export async function exportVideo(
    project: Project,
    s: ExportSettings,
    deps: ExportDeps,
    onProgress: (p: ExportProgress) => void,
    signal: AbortSignal,
): Promise<ExportResult> {
    if (!supportsWebCodecs()) throw new Error('WebCodecs is not available in this browser.');
    const t0 = performance.now();
    const fps = s.fps;
    const start = Math.max(0, s.start);
    const end = Math.min(deps.buffer.duration, Math.max(start + 0.5, s.end));
    const totalFrames = Math.max(1, Math.round((end - start) * fps));
    onProgress({ stage: 'preparing', frame: 0, totalFrames, renderFps: 0, etaSeconds: 0, bytes: 0 });

    const bitrate = targetBitrate(s);
    const codecs = await pickCodecs(s, bitrate);
    const wakeLock = await requestWakeLock();
    const baseTitle = document.title;

    const canvas = document.createElement('canvas');
    canvas.width = s.width;
    canvas.height = s.height;
    const engine = new Engine(canvas, { preserveDrawingBuffer: true, loseContextOnDispose: true, fontWeight: deps.fontWeight, fontsVersion: deps.fontsVersion });
    engine.setSize(s.width, s.height);
    engine.warmup();
    engine.reset(1234);

    let bytes = 0;
    const toDisk = !!s.writable;
    const target = toDisk
        ? new StreamTarget(
              new WritableStream({
                  write: async (chunk) => {
                      bytes = Math.max(bytes, chunk.position + chunk.data.byteLength);
                      await s.writable!.write({ type: 'write', position: chunk.position, data: chunk.data });
                  },
              }),
              { chunked: true },
          )
        : new BufferTarget();
    const format = s.format === 'mp4' ? new Mp4OutputFormat({ fastStart: toDisk ? false : 'in-memory' }) : new WebMOutputFormat();
    const output = new Output({ format, target });

    const videoSource = new CanvasSource(canvas, {
        codec: codecs.video,
        quality: new Quality({ bitrate }),
        keyFrameInterval: 2,
    });
    output.addVideoTrack(videoSource, { frameRate: fps });
    const audioSource = new AudioBufferSource({
        codec: codecs.audio,
        quality: new Quality({ bitrate: codecs.audio === 'aac' ? 320_000 : 256_000 }),
    });
    output.addAudioTrack(audioSource);
    output.setMetadataTags({
        title: project.meta.title || undefined,
        artist: project.meta.artist || undefined,
        comment: 'Made with Canvasbeats',
    });
    await output.start();

    const audio = sliceAudio(deps.buffer, start, end, s.audioFadeOut);
    let audioDone = 0;
    const AUDIO_STEP = 1;
    const fe = new FeatureExtractor({
        channels: Array.from({ length: deps.buffer.numberOfChannels }, (_, i) => deps.buffer.getChannelData(i)),
        sampleRate: deps.buffer.sampleRate,
        duration: deps.buffer.duration,
    });
    fe.setAnalysis(deps.env, deps.interp);
    const dt = 1 / fps;
    const images = deps.images;
    const pv = deps.previewCanvas?.getContext('2d') ?? null;

    try {
        // pre-roll so particles, trails and smoothing are warmed up at frame 0
        const pre = Math.min(start, 3);
        let frame = 0;
        for (let t = start - pre; t < start - dt / 2; t += dt) {
            const f = fe.compute(t, dt, deps.react);
            engine.render(project, f, { time: t, dt, rangeStart: start, rangeEnd: end, frame: frame++ }, images);
        }

        let lastReport = performance.now();
        const renderStart = performance.now();
        for (let i = 0; i < totalFrames; i++) {
            if (signal.aborted) throw new ExportCancelled();
            const t = start + i * dt;
            const f = fe.compute(t, dt, deps.react);
            engine.render(project, f, { time: t, dt, rangeStart: start, rangeEnd: end, frame: frame++ }, images);
            await videoSource.add(i * dt, dt);

            const needAudio = Math.min(end - start, (i + 1) * dt + AUDIO_STEP);
            while (audioDone < needAudio - 1e-6) {
                const next = Math.min(end - start, audioDone + AUDIO_STEP);
                await audioSource.add(audioChunk(audio, audioDone, next));
                audioDone = next;
            }

            const now = performance.now();
            if (now - lastReport > 250 || i === totalFrames - 1) {
                lastReport = now;
                const elapsed = (now - renderStart) / 1000;
                const renderFps = (i + 1) / Math.max(1e-3, elapsed);
                if (pv && deps.previewCanvas) pv.drawImage(canvas, 0, 0, deps.previewCanvas.width, deps.previewCanvas.height);
                document.title = `${Math.floor(((i + 1) / totalFrames) * 100)}% · rendering · Canvasbeats`;
                onProgress({
                    stage: 'rendering',
                    frame: i + 1,
                    totalFrames,
                    renderFps,
                    etaSeconds: (totalFrames - i - 1) / Math.max(0.01, renderFps),
                    bytes,
                });
                await yieldToUi();
            }
        }
        while (audioDone < end - start - 1e-6) {
            const next = Math.min(end - start, audioDone + AUDIO_STEP);
            await audioSource.add(audioChunk(audio, audioDone, next));
            audioDone = next;
        }

        onProgress({ stage: 'finalizing', frame: totalFrames, totalFrames, renderFps: 0, etaSeconds: 0, bytes });
        await output.finalize();
        if (toDisk) await s.writable!.close();
        let blob: Blob | null = null;
        if (target instanceof BufferTarget && target.buffer) {
            blob = new Blob([target.buffer], { type: s.format === 'mp4' ? 'video/mp4' : 'video/webm' });
            bytes = blob.size;
        }
        onProgress({ stage: 'done', frame: totalFrames, totalFrames, renderFps: 0, etaSeconds: 0, bytes });
        return {
            blob,
            fileName: s.fileName,
            savedToDisk: toDisk,
            videoCodec: codecs.video,
            audioCodec: codecs.audio,
            bytes,
            seconds: (performance.now() - t0) / 1000,
        };
    } catch (err) {
        await output.cancel().catch(() => undefined);
        if (toDisk) await s.writable!.abort().catch(() => undefined);
        throw err;
    } finally {
        engine.dispose();
        document.title = baseTitle;
        void wakeLock?.release().catch(() => undefined);
    }
}


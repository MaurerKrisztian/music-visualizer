// Fallback for browsers without WebCodecs: records the live preview canvas in
// real time with MediaRecorder (WebM). Slower and less exact than the offline
// exporter, but works almost everywhere.

import { preview } from '../app/preview';
import { appStore, player, seek } from '../app/session';

export function supportsRealtime(): boolean {
    return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

export async function recordRealtime(
    opts: { width: number; height: number; fps: number; start: number; end: number; bitrate: number },
    onProgress: (p: number) => void,
    signal: AbortSignal,
): Promise<Blob> {
    const canvas = preview.getCanvas();
    if (!canvas) throw new Error('Preview is not ready.');
    preview.forcedSize = { w: opts.width, h: opts.height };
    preview.invalidate();
    const audio = player.getRecordStream();
    const video = canvas.captureStream(opts.fps);
    const stream = new MediaStream([...video.getVideoTracks(), ...audio.getAudioTracks()]);
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: opts.bitrate, audioBitsPerSecond: 256_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
    try {
        player.pause();
        seek(opts.start);
        await new Promise((r) => setTimeout(r, 150));
        rec.start(1000);
        await player.play(opts.start);
        appStore.update((s) => void (s.playing = true), false);
        await new Promise<void>((resolve) => {
            const iv = setInterval(() => {
                const t = player.currentTime;
                onProgress(Math.min(1, (t - opts.start) / (opts.end - opts.start)));
                if (signal.aborted || t >= opts.end - 0.02 || !player.playing) {
                    clearInterval(iv);
                    resolve();
                }
            }, 100);
        });
        rec.stop();
        await done;
    } finally {
        player.pause();
        appStore.update((s) => void (s.playing = false), false);
        preview.forcedSize = null;
        preview.invalidate();
    }
    if (signal.aborted) throw new Error('Export cancelled');
    return new Blob(chunks, { type: 'video/webm' });
}

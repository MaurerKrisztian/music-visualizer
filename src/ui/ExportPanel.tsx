import { useEffect, useRef, useState } from 'react';
import { engineImages, preview } from '../app/preview';
import { appStore, getAudioBuffer, player, reactOptions } from '../app/session';
import { downloadBlob, estimateBytes, safeFileName, supportsWebCodecs, targetBitrate, type ExportProgress, type ExportResult } from '../export/settings';
import { recordRealtime, supportsRealtime } from '../export/realtime';
import { ensureFont, fontsVersion, fontWeight } from '../project/fonts';
import { projectStore, setProject, useProject, useStore } from '../project/store';
import { RESOLUTIONS } from '../project/types';
import { Hint, Section, Segmented, Select, Slider } from './controls';
import { formatBytes, formatTime, parseTime } from './format';
import { IconFilm } from './icons';

interface Job {
    progress: ExportProgress | null;
    realtime: number | null;
    abort: AbortController;
    result: ExportResult | null;
    error: string | null;
    url: string | null;
}

type SavePicker = (opts: unknown) => Promise<{ createWritable: () => Promise<FileSystemWritableFileStream> }>;

export function ExportPanel() {
    const ex = useProject((p) => p.export);
    const meta = useProject((p) => p.meta);
    const duration = useStore(appStore, (s) => s.track?.duration ?? 0);
    const interp = useStore(appStore, (s) => s.interp);
    const ready = useStore(appStore, (s) => s.stage === 'ready');
    const [toDisk, setToDisk] = useState(false);
    const [job, setJob] = useState<Job | null>(null);
    const [snapBusy, setSnapBusy] = useState(false);
    const pvCanvas = useRef<HTMLCanvasElement>(null);
    const webcodecs = supportsWebCodecs();
    const canPick = typeof (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker === 'function';

    const res = RESOLUTIONS[ex.resolution] ?? RESOLUTIONS['1080p'];
    const start = Math.max(0, Math.min(ex.rangeStart ?? 0, duration));
    const end = Math.max(start, Math.min(ex.rangeEnd ?? duration, duration));
    const len = Math.max(0, end - start);
    const settingsForEstimate = { width: res.w, height: res.h, fps: ex.fps, quality: ex.quality };
    const bitrate = targetBitrate(settingsForEstimate);
    const est = estimateBytes(settingsForEstimate, len, ex.format);
    const baseName = safeFileName([meta.artist, meta.title].filter(Boolean).join(' - ') || 'canvasbeats');
    const fileName = `${baseName}${ex.resolution === 'short' ? ' (short)' : ''}.${ex.format}`;

    useEffect(() => () => void (job?.url && URL.revokeObjectURL(job.url)), [job?.url]);

    const setRange = (a: number | null, b: number | null) =>
        projectStore.update((p) => {
            p.export.rangeStart = a;
            p.export.rangeEnd = b;
        });

    const dropClip = () => {
        if (!interp || interp.drops.length === 0) {
            setRange(Math.max(0, Math.min(duration - 30, duration * 0.4)), Math.min(duration, duration * 0.4 + 30));
            return;
        }
        const bar = (60 / interp.bpm) * 4;
        const a = Math.max(0, interp.drops[0] - 8 * bar);
        setRange(a, Math.min(duration, a + Math.min(59, Math.max(30, 8 * bar + 16 * bar))));
    };

    const run = async () => {
        const buffer = getAudioBuffer();
        const st = appStore.get();
        if (!buffer || !st.env || !st.interp) return;
        const project = projectStore.get();
        let writable: FileSystemWritableFileStream | undefined;
        let streamIt = toDisk;
        if (!streamIt && canPick && webcodecs && est > 700e6) {
            streamIt = window.confirm(`This video will be about ${formatBytes(est)}. Stream it straight to a file on disk to avoid running out of memory?`);
        }
        if (streamIt && canPick && webcodecs) {
            try {
                const picker = (window as unknown as { showSaveFilePicker: SavePicker }).showSaveFilePicker;
                const handle = await picker({
                    suggestedName: fileName,
                    types: [{ description: 'Video', accept: { [ex.format === 'mp4' ? 'video/mp4' : 'video/webm']: [`.${ex.format}`] } }],
                });
                writable = await handle.createWritable();
            } catch {
                return; // user cancelled the picker
            }
        }
        const abort = new AbortController();
        setJob({ progress: null, realtime: null, abort, result: null, error: null, url: null });
        player.pause();
        appStore.update((s) => {
            s.playing = false;
            s.exporting = true;
        }, false);
        await ensureFont(project.text.font);
        await document.fonts.ready;
        try {
            if (webcodecs) {
                preview.paused = true;
                const { exportVideo } = await import('../export/exporter');
                const result = await exportVideo(
                    project,
                    { width: res.w, height: res.h, fps: ex.fps, format: ex.format, quality: ex.quality, start, end, audioFadeOut: ex.audioFadeOut, fileName, writable },
                    {
                        buffer,
                        env: st.env,
                        interp: st.interp,
                        images: engineImages(project),
                        react: reactOptions(project),
                        fontWeight,
                        fontsVersion,
                        previewCanvas: pvCanvas.current,
                    },
                    (progress) => setJob((j) => (j ? { ...j, progress } : j)),
                    abort.signal,
                );
                let url: string | null = null;
                if (result.blob) {
                    downloadBlob(result.blob, result.fileName);
                    url = URL.createObjectURL(result.blob);
                }
                setJob((j) => (j ? { ...j, result, url } : j));
            } else {
                const blob = await recordRealtime({ width: res.w, height: res.h, fps: ex.fps, start, end, bitrate }, (p) => setJob((j) => (j ? { ...j, realtime: p } : j)), abort.signal);
                const name = fileName.replace(/\.(mp4|webm)$/, blob.type.includes('mp4') ? '.mp4' : '.webm');
                downloadBlob(blob, name);
                setJob((j) => (j ? { ...j, url: URL.createObjectURL(blob), result: { blob, fileName: name, savedToDisk: false, videoCodec: 'vp9', audioCodec: 'opus', bytes: blob.size, seconds: len } } : j));
            }
        } catch (err) {
            const msg = err instanceof Error && err.message === 'Export cancelled' ? 'Export cancelled.' : err instanceof Error ? err.message : String(err);
            setJob((j) => (j ? { ...j, error: msg } : j));
        } finally {
            preview.paused = false;
            preview.invalidate();
            appStore.update((s) => void (s.exporting = false), false);
        }
    };

    const snapshot = async () => {
        const buffer = getAudioBuffer();
        const st = appStore.get();
        if (!buffer || !st.env || !st.interp) return;
        setSnapBusy(true);
        try {
            const project = projectStore.get();
            await ensureFont(project.text.font);
            const { renderSnapshot } = await import('../export/snapshot');
            const blob = await renderSnapshot(
                project,
                { buffer, env: st.env, interp: st.interp, images: engineImages(project), react: reactOptions(project), fontWeight, fontsVersion },
                player.currentTime,
                res.w,
                res.h,
            );
            downloadBlob(blob, `${baseName} ${formatTime(player.currentTime).replace(':', '-')}.png`);
        } catch (err) {
            window.alert(err instanceof Error ? err.message : String(err));
        } finally {
            setSnapBusy(false);
        }
    };

    const p = job?.progress;
    const pct = p ? (p.frame / Math.max(1, p.totalFrames)) * 100 : (job?.realtime ?? 0) * 100;
    const running = !!job && !job.result && !job.error;

    return (
        <div className="panel">
            <Section title="Video">
                <Select label="Resolution" path="export.resolution" options={Object.entries(RESOLUTIONS).map(([k, r]) => ({ value: k, label: r.label }))} />
                <Segmented
                    label="Frame rate"
                    path="export.fps"
                    options={[
                        { value: 30, label: '30 fps' },
                        { value: 60, label: '60 fps' },
                    ]}
                />
                <Segmented
                    label="Format"
                    path="export.format"
                    options={[
                        { value: 'mp4', label: 'MP4 · H.264' },
                        { value: 'webm', label: 'WebM · VP9' },
                    ]}
                />
                <Segmented
                    label="Quality"
                    path="export.quality"
                    options={[
                        { value: 'standard', label: 'Standard' },
                        { value: 'high', label: 'High' },
                        { value: 'max', label: 'Max' },
                    ]}
                />
                <Hint>
                    {res.w}×{res.h} · {(bitrate / 1e6).toFixed(0)} Mbit/s · about {formatBytes(est)} for {formatTime(len)}. MP4 at 60 fps is the best choice for YouTube.
                </Hint>
            </Section>

            <Section title="Range">
                <div className="row wrap">
                    <button className={`btn small${ex.rangeStart === null && ex.rangeEnd === null ? ' on' : ''}`} onClick={() => setRange(null, null)}>
                        Full track
                    </button>
                    <button className="btn small" onClick={dropClip} title="8 bars of build-up into the first drop">
                        Drop clip
                    </button>
                    <button
                        className="btn small"
                        onClick={() => {
                            dropClip();
                            setProject('export.resolution', 'short');
                        }}
                        title="Vertical 9:16 clip of the first drop"
                    >
                        Shorts / TikTok
                    </button>
                </div>
                <TimeInput label="Start" value={start} onChange={(v) => setRange(v, ex.rangeEnd)} />
                <TimeInput label="End" value={end} onChange={(v) => setRange(ex.rangeStart, v)} />
                <Slider label="Audio fade-out" path="export.audioFadeOut" min={0} max={8} step={0.1} unit=" s" />
            </Section>

            <Section title="Render">
                {webcodecs && canPick && (
                    <label className="ctl toggle">
                        <span className="lbl">Stream to disk</span>
                        <button type="button" className={`switch${toDisk ? ' on' : ''}`} onClick={() => setToDisk(!toDisk)}>
                            <i />
                        </button>
                    </label>
                )}
                {webcodecs && canPick && <Hint>Recommended for long or 4K videos: frames are written to the file as they are encoded, so memory stays low.</Hint>}
                {!webcodecs && (
                    <Hint>
                        {supportsRealtime()
                            ? 'This browser has no WebCodecs, so the video is recorded in real time. For frame-perfect export use a recent Chrome, Edge, Firefox or Safari.'
                            : 'Video export is not supported in this browser.'}
                    </Hint>
                )}
                <button className="btn primary big" disabled={!ready || running || len < 0.5 || (!webcodecs && !supportsRealtime())} onClick={() => void run()}>
                    <IconFilm /> Render {ex.format.toUpperCase()}
                </button>
            </Section>

            <Section title="Still image" defaultOpen={false}>
                <Hint>Saves the frame at the playhead as a {res.w}×{res.h} PNG, handy for YouTube thumbnails and cover posts.</Hint>
                <button className="btn" disabled={!ready || running || snapBusy} onClick={() => void snapshot()}>
                    {snapBusy ? 'Rendering…' : 'Save frame as PNG'}
                </button>
            </Section>

            {job && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h3>{job.result ? 'Video ready' : job.error ? 'Export stopped' : 'Rendering video…'}</h3>
                        <canvas ref={pvCanvas} width={480} height={Math.round((480 * res.h) / res.w)} className="export-preview" style={{ aspectRatio: `${res.w} / ${res.h}` }} />
                        {!job.result && !job.error && (
                            <>
                                <div className="bar big">
                                    <i style={{ width: `${pct.toFixed(1)}%` }} />
                                </div>
                                <div className="export-stats">
                                    {p ? (
                                        <>
                                            <span>
                                                {p.stage === 'preparing' ? 'Preparing encoder…' : p.stage === 'finalizing' ? 'Finalising file…' : `Frame ${p.frame} / ${p.totalFrames}`}
                                            </span>
                                            {p.stage === 'rendering' && (
                                                <span>
                                                    {p.renderFps.toFixed(0)} fps · {(p.renderFps / ex.fps).toFixed(2)}× real time · {formatTime(p.etaSeconds)} left
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span>{job.realtime !== null ? 'Recording in real time, keep this tab visible…' : 'Starting…'}</span>
                                    )}
                                </div>
                                <button className="btn ghost" onClick={() => job.abort.abort()}>
                                    Cancel
                                </button>
                            </>
                        )}
                        {job.result && (
                            <>
                                <p className="ok">
                                    {job.result.savedToDisk ? 'Saved to disk' : 'Downloaded'} <b>{job.result.fileName}</b> · {formatBytes(job.result.bytes)} · {job.result.videoCodec.toUpperCase()} + {job.result.audioCodec.toUpperCase()} · rendered in {formatTime(job.result.seconds)}
                                </p>
                                <div className="row">
                                    {job.url && (
                                        <a className="btn primary" href={job.url} download={job.result.fileName}>
                                            Download again
                                        </a>
                                    )}
                                    <button className="btn ghost" onClick={() => setJob(null)}>
                                        Close
                                    </button>
                                </div>
                            </>
                        )}
                        {job.error && (
                            <>
                                <p className="err">{job.error}</p>
                                <button className="btn ghost" onClick={() => setJob(null)}>
                                    Close
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function TimeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number | null) => void }) {
    const [text, setText] = useState(formatTime(value, true));
    useEffect(() => setText(formatTime(value, true)), [value]);
    return (
        <div className="ctl time-input">
            <span className="lbl">{label}</span>
            <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => {
                    const v = parseTime(text);
                    if (v !== null) onChange(v);
                    else setText(formatTime(value, true));
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <button className="btn small ghost" onClick={() => onChange(player.currentTime)} title="Use the playhead position">
                ← playhead
            </button>
        </div>
    );
}

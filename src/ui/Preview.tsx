import { useEffect, useRef, useState } from 'react';
import { exportAspect, preview } from '../app/preview';
import { toggleFullscreen } from '../app/fullscreen';
import { appStore, togglePlay } from '../app/session';
import { useProject, useStore } from '../project/store';

export function Preview() {
    const ref = useRef<HTMLCanvasElement>(null);
    const [full, setFull] = useState(false);
    const aspect = useProject(exportAspect);
    const stage = useStore(appStore, (s) => s.stage);
    const progress = useStore(appStore, (s) => s.progress);
    const message = useStore(appStore, (s) => s.message);
    const exporting = useStore(appStore, (s) => s.exporting);
    const isDemo = useStore(appStore, (s) => !!s.track?.isDemo);
    const playing = useStore(appStore, (s) => s.playing);

    useEffect(() => {
        if (!ref.current) return;
        preview.attach(ref.current);
        return () => preview.detach();
    }, []);

    useEffect(() => {
        preview.invalidate();
    }, [aspect]);

    useEffect(() => {
        const on = () => {
            setFull(!!document.fullscreenElement);
            preview.invalidate();
        };
        document.addEventListener('fullscreenchange', on);
        return () => document.removeEventListener('fullscreenchange', on);
    }, []);

    const busy = stage === 'decoding' || stage === 'analyzing';
    return (
        <div className="preview-wrap">
            <div className="preview-stage" style={{ ['--ar' as string]: String(aspect) }}>
                <canvas ref={ref} className="preview-canvas" onClick={() => void togglePlay()} />
                {busy && (
                    <div className="overlay">
                        <div className="spinner" />
                        <div className="overlay-msg">{message}</div>
                        {stage === 'analyzing' && (
                            <div className="bar">
                                <i style={{ width: `${Math.round(progress * 100)}%` }} />
                            </div>
                        )}
                    </div>
                )}
                {stage === 'error' && (
                    <div className="overlay error">
                        <div className="overlay-msg">{message}</div>
                    </div>
                )}
                {preview.error && (
                    <div className="overlay error">
                        <div className="overlay-msg">WebGL2 is required: {preview.error}</div>
                    </div>
                )}
                {isDemo && stage === 'ready' && !playing && (
                    <div className="demo-pill">Demo track · drop your own music anywhere, or press Space to play</div>
                )}
                {exporting && <div className="overlay dim" />}
                <button
                    type="button"
                    className="fs-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFullscreen();
                    }}
                    title={full ? 'Exit fullscreen (F or Esc)' : 'Fullscreen (F)'}
                    aria-label={full ? 'Exit fullscreen' : 'Fullscreen'}
                >
                    {full ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
}

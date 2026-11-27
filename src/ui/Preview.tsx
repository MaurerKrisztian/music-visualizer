import { useEffect, useRef } from 'react';
import { exportAspect, preview } from '../app/preview';
import { appStore, togglePlay } from '../app/session';
import { useProject, useStore } from '../project/store';

export function Preview() {
    const ref = useRef<HTMLCanvasElement>(null);
    const aspect = useProject(exportAspect);
    const stage = useStore(appStore, (s) => s.stage);
    const progress = useStore(appStore, (s) => s.progress);
    const message = useStore(appStore, (s) => s.message);
    const exporting = useStore(appStore, (s) => s.exporting);

    useEffect(() => {
        if (!ref.current) return;
        preview.attach(ref.current);
        return () => preview.detach();
    }, []);

    useEffect(() => {
        preview.invalidate();
    }, [aspect]);

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
                {exporting && <div className="overlay dim" />}
            </div>
        </div>
    );
}

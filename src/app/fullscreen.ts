import { toast } from './session';

/** Toggles fullscreen "watch mode" for the preview. */
export function toggleFullscreen(): void {
    const stage = document.querySelector('.preview-stage') as HTMLElement | null;
    if (!stage) return;
    if (document.fullscreenElement) {
        void document.exitFullscreen?.();
        return;
    }
    const req = stage.requestFullscreen?.bind(stage);
    if (!req) {
        toast('Fullscreen is not available here.', 'error');
        return;
    }
    req().catch(() => toast('Fullscreen is not available here.', 'error'));
}

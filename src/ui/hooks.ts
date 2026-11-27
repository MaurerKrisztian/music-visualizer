import { useRef, useSyncExternalStore } from 'react';
import { assets } from '../project/assets';
import { getPath, setProject, useProject } from '../project/store';

export function useBind<T>(path: string): [T, (v: T) => void] {
    const v = useProject((p) => getPath(p, path) as T);
    return [v, (nv: T) => setProject(path, nv)];
}

/** Re-renders when images or fonts are added/removed. */
export function useAssets(): number {
    const ver = useRef(0);
    return useSyncExternalStore(
        (cb) =>
            assets.subscribe(() => {
                ver.current++;
                cb();
            }),
        () => ver.current,
    );
}

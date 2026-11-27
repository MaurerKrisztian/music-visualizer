import { useSyncExternalStore } from 'react';
import { createDefaultProject } from './defaults';
import type { Project } from './types';

type Listener = () => void;

/** Tiny observable store with undo/redo snapshots. */
export class Store<T> {
    private state: T;
    private readonly listeners = new Set<Listener>();
    private undoStack: T[] = [];
    private redoStack: T[] = [];
    private lastCommit = 0;
    private pendingBase: T | null = null;

    constructor(initial: T, private readonly trackHistory = false) {
        this.state = initial;
    }

    get = (): T => this.state;

    subscribe = (l: Listener): (() => void) => {
        this.listeners.add(l);
        return () => this.listeners.delete(l);
    };

    private emit(): void {
        this.listeners.forEach((l) => l());
    }

    private remember(prev: T): void {
        if (!this.trackHistory) return;
        const now = Date.now();
        // group rapid changes (slider drags) into one undo step
        if (!this.pendingBase || now - this.lastCommit > 600) {
            this.undoStack.push(prev);
            if (this.undoStack.length > 100) this.undoStack.shift();
            this.redoStack = [];
        }
        this.pendingBase = prev;
        this.lastCommit = now;
    }

    set(next: T, record = true): void {
        if (next === this.state) return;
        if (record) this.remember(this.state);
        this.state = next;
        this.emit();
    }

    update(fn: (draft: T) => void, record = true): void {
        const draft = structuredClone(this.state);
        fn(draft);
        this.set(draft, record);
    }

    undo(): void {
        const prev = this.undoStack.pop();
        if (!prev) return;
        this.redoStack.push(this.state);
        this.state = prev;
        this.pendingBase = null;
        this.emit();
    }

    redo(): void {
        const next = this.redoStack.pop();
        if (!next) return;
        this.undoStack.push(this.state);
        this.state = next;
        this.pendingBase = null;
        this.emit();
    }
}

export const projectStore = new Store<Project>(createDefaultProject(), true);

export function useProject<S>(selector: (p: Project) => S): S {
    return useSyncExternalStore(projectStore.subscribe, () => selector(projectStore.get()));
}

export function useStore<T, S>(store: Store<T>, selector: (s: T) => S): S {
    return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

/** Sets a nested value by dotted path, e.g. setProject('fx.bloom', 0.5). */
export function setProject(path: string, value: unknown): void {
    projectStore.update((draft) => {
        const keys = path.split('.');
        let obj = draft as unknown as Record<string, unknown>;
        for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]] as Record<string, unknown>;
        obj[keys[keys.length - 1]] = value;
    });
}

export function getPath(p: Project, path: string): unknown {
    let obj: unknown = p;
    for (const k of path.split('.')) obj = (obj as Record<string, unknown>)?.[k];
    return obj;
}

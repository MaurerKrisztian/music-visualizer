// Minimal promise wrapper around IndexedDB (two object stores).

const DB_NAME = 'canvasbeats';
const STORES = ['assets', 'kv'] as const;
type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB unavailable'));
            return;
        }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => (dbPromise = null));
    return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return open().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                const t = db.transaction(store, mode);
                const req = fn(t.objectStore(store));
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            }),
    );
}

export const idbGet = <T>(store: StoreName, key: string) => tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>);
export const idbPut = (store: StoreName, key: string, value: unknown) => tx(store, 'readwrite', (s) => s.put(value, key));
export const idbDelete = (store: StoreName, key: string) => tx(store, 'readwrite', (s) => s.delete(key));

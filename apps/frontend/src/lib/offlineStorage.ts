const DB_NAME = 'qualcanvas-offline';
const STORE_NAME = 'canvases';

// IndexedDB can be unavailable in some contexts (private browsing, disabled
// storage, SSR). Detect once and treat all offline-cache calls as no-ops when
// unavailable instead of crashing callers.
function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!idbAvailable()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch (err) {
      reject(err);
      return;
    }
    request.onupgradeneeded = () => {
      try {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      } catch (err) {
        reject(err);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cacheCanvas(canvas: any): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(canvas);
  } catch {
    // Private browsing / disabled storage — silently skip. The UI will work
    // without offline cache; we don't want to surface IndexedDB errors here.
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCachedCanvas(id: string): Promise<any | null> {
  if (!idbAvailable()) return null;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearCachedCanvas(id: string): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch {
    // Best-effort — nothing to do if IndexedDB is unreachable.
  }
}

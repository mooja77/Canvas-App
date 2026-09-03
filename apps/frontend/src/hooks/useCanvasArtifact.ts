import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasApi } from '../services/api';

export type CanvasArtifactType = 'sticky-notes' | 'theme-groups' | 'code-weights';

const SAVE_DELAY_MS = 350;
const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();
const dirtyKey = (storageKey: string): string => `${storageKey}-server-dirty`;

function readStored<T>(storageKey: string, fallback: T, validate: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStored<T>(storageKey: string, value: T): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // The server remains the durable copy when browser storage is unavailable.
  }
}

function markDirty(storageKey: string): void {
  try {
    localStorage.setItem(dirtyKey(storageKey), '1');
  } catch {
    // A later edit or reload can retry; never make a canvas interaction fail.
  }
}

function clearDirty(storageKey: string): void {
  try {
    localStorage.removeItem(dirtyKey(storageKey));
  } catch {
    // An unnecessary migration retry is safer than losing data.
  }
}

/**
 * Clear the dirty marker only if the stored copy is still the value that was
 * just saved, so an older request finishing after a newer edit cannot clear
 * the newer edit's marker.
 */
function clearDirtyIfCurrent<T>(storageKey: string, savedValue: T): void {
  try {
    if (localStorage.getItem(storageKey) === JSON.stringify(savedValue)) clearDirty(storageKey);
  } catch {
    // Leave dirty so a later load retries.
  }
}

function isDirty(storageKey: string): boolean {
  try {
    return localStorage.getItem(dirtyKey(storageKey)) === '1';
  } catch {
    return false;
  }
}

function hasStoredValue(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) !== null;
  } catch {
    return false;
  }
}

const saveKey = (canvasId: string, type: CanvasArtifactType): string => `${canvasId}:${type}`;

function cancelScheduledSave(canvasId: string, type: CanvasArtifactType): void {
  const key = saveKey(canvasId, type);
  const existing = pendingSaves.get(key);
  if (existing) {
    clearTimeout(existing);
    pendingSaves.delete(key);
  }
}

function scheduleSave<T>(canvasId: string, type: CanvasArtifactType, storageKey: string, value: T): void {
  const key = saveKey(canvasId, type);
  cancelScheduledSave(canvasId, type);
  markDirty(storageKey);
  pendingSaves.set(
    key,
    setTimeout(() => {
      pendingSaves.delete(key);
      void canvasApi
        .saveArtifact(canvasId, type, value)
        .then(() => clearDirtyIfCurrent(storageKey, value))
        .catch(() => {
          // Keep the dirty marker and local copy. The next load/edit retries.
        });
    }, SAVE_DELAY_MS),
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Identity of one array item for merging: its `id` when it has one, else its content. */
function itemKey(item: unknown): string {
  if (isRecord(item) && (typeof item.id === 'string' || typeof item.id === 'number')) return `id:${item.id}`;
  return `raw:${JSON.stringify(item)}`;
}

/**
 * Union of the server copy and a local copy that was edited before the server
 * answered (bug hunt 2026-09-02 H2). Previously the dirty local copy was PUT
 * wholesale, so one sticky note added while the GET was pending replaced every
 * note on the server. Arrays are keyed by `id`: server order first, then the
 * local-only items, and the local version wins for ids present in both
 * because it is the newer edit. Records (code-weights) are keyed by property.
 * Anything else has no merge semantics, so the local edit wins.
 */
function mergeArtifact<T>(server: T, local: T): T {
  if (Array.isArray(server) && Array.isArray(local)) {
    const localByKey = new Map<string, unknown>(local.map((item: unknown) => [itemKey(item), item]));
    const serverKeys = new Set<string>();
    const merged: unknown[] = server.map((item: unknown) => {
      const key = itemKey(item);
      serverKeys.add(key);
      return localByKey.has(key) ? localByKey.get(key) : item;
    });
    for (const item of local as unknown[]) {
      if (!serverKeys.has(itemKey(item))) merged.push(item);
    }
    return merged as T;
  }
  if (isRecord(server) && isRecord(local)) return { ...server, ...local } as T;
  return local;
}

interface ReconcileOptions<T> {
  canvasId: string;
  type: CanvasArtifactType;
  storageKey: string;
  /** The stored value read when the hook mounted. */
  localValue: T;
  fallback: T;
  validate: (value: unknown) => value is T;
  /** True once `updateValue` has run for this canvas since the hook mounted. */
  editedSinceMount: () => boolean;
  /** Publish a value to React state (no-op once the effect is cancelled). */
  commit: (value: T) => void;
}

async function reconcileWithServer<T>(options: ReconcileOptions<T>): Promise<void> {
  const { canvasId, type, storageKey, localValue, fallback, validate, editedSinceMount, commit } = options;
  let server: { exists?: boolean; value?: unknown } | undefined;
  try {
    const response = await canvasApi.getArtifact(canvasId, type);
    server = response.data.data as { exists?: boolean; value?: unknown } | undefined;
  } catch {
    // Bug hunt 2026-09-02 H1: the mount-time closure value is stale once the
    // user has edited, and publishing it erased the edit from state (the next
    // edit then overwrote localStorage and the server without it). Re-read the
    // store, and never publish anything over an edit made while the GET was
    // pending: state already holds the newest value.
    if (!editedSinceMount()) commit(readStored(storageKey, localValue, validate));
    return;
  }

  const serverValue = server?.exists && validate(server.value) ? server.value : undefined;
  const edited = editedSinceMount();
  const localIsDirty = edited || isDirty(storageKey);
  const legacyLocalOnly = serverValue === undefined && hasStoredValue(storageKey);

  if (!localIsDirty && !legacyLocalOnly) {
    // Nothing unsaved here: the server copy is the truth.
    if (serverValue === undefined) {
      commit(fallback);
      return;
    }
    writeStored(storageKey, serverValue);
    commit(serverValue);
    return;
  }

  // The local copy holds something the server does not. Only when the server
  // has no row at all (a legacy local-only document, or a pre-mount dirty copy
  // whose first save never landed) may the local copy be pushed wholesale;
  // otherwise merge, so an edit racing the GET cannot replace the server copy.
  const latestLocal = readStored(storageKey, localValue, validate);
  const candidate = serverValue === undefined ? latestLocal : mergeArtifact(serverValue, latestLocal);
  const next = validate(candidate) ? candidate : latestLocal;

  // Publish before the PUT so any edit made during the request builds on the
  // merged value rather than on the pre-merge local copy.
  writeStored(storageKey, next);
  commit(next);
  if (hasStoredValue(storageKey)) {
    // The pending debounced save carries the PRE-merge local copy; letting it
    // fire after this PUT would put that stale copy back over the merge. Only
    // cancel it when the store is readable, so an in-memory edit still reaches
    // the server when browser storage is unavailable.
    cancelScheduledSave(canvasId, type);
  }
  markDirty(storageKey);
  try {
    await canvasApi.saveArtifact(canvasId, type, next);
    clearDirtyIfCurrent(storageKey, next);
  } catch {
    // Keep the dirty marker and local copy. The next load/edit retries.
  }
}

/** Server-backed canvas document with a local cache and local-data migration. */
export function useCanvasArtifact<T>(options: {
  canvasId: string | null;
  type: CanvasArtifactType;
  storageKeyPrefix: string;
  fallback: T;
  validate: (value: unknown) => value is T;
}): [T, (updater: T | ((previous: T) => T)) => void] {
  const { canvasId, type, storageKeyPrefix, fallback, validate } = options;
  const [value, setValue] = useState<T>(fallback);
  // Set by updateValue; lets the initial server reconcile tell an edit made
  // while its GET was pending apart from a stale dirty marker left by an
  // earlier session (bug hunt 2026-09-02 H1/H2).
  const editedSinceMount = useRef(false);

  useEffect(() => {
    if (!canvasId) {
      setValue(fallback);
      return;
    }
    let cancelled = false;
    editedSinceMount.current = false;
    const storageKey = `${storageKeyPrefix}${canvasId}`;
    const localValue = readStored(storageKey, fallback, validate);
    setValue(localValue);
    void reconcileWithServer({
      canvasId,
      type,
      storageKey,
      localValue,
      fallback,
      validate,
      editedSinceMount: () => editedSinceMount.current,
      commit: (next) => {
        if (!cancelled) setValue(next);
      },
    });
    return () => {
      cancelled = true;
    };
  }, [canvasId, fallback, storageKeyPrefix, type, validate]);

  const updateValue = useCallback(
    (updater: T | ((previous: T) => T)) => {
      if (!canvasId) return;
      editedSinceMount.current = true;
      setValue((previous) => {
        const next = typeof updater === 'function' ? (updater as (value: T) => T)(previous) : updater;
        const storageKey = `${storageKeyPrefix}${canvasId}`;
        writeStored(storageKey, next);
        scheduleSave(canvasId, type, storageKey, next);
        return next;
      });
    },
    [canvasId, storageKeyPrefix, type],
  );

  return [value, updateValue];
}

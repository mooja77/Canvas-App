import { useCallback, useEffect, useState } from 'react';
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

function scheduleSave<T>(canvasId: string, type: CanvasArtifactType, storageKey: string, value: T): void {
  const key = `${canvasId}:${type}`;
  const existing = pendingSaves.get(key);
  if (existing) clearTimeout(existing);
  markDirty(storageKey);
  pendingSaves.set(
    key,
    setTimeout(() => {
      pendingSaves.delete(key);
      void canvasApi
        .saveArtifact(canvasId, type, value)
        .then(() => {
          // Do not clear a newer edit's dirty marker when an older request
          // finishes after it.
          try {
            if (localStorage.getItem(storageKey) === JSON.stringify(value)) clearDirty(storageKey);
          } catch {
            // Leave dirty so a later load retries.
          }
        })
        .catch(() => {
          // Keep the dirty marker and local copy. The next load/edit retries.
        });
    }, SAVE_DELAY_MS),
  );
}

async function reconcileWithServer<T>(
  canvasId: string,
  type: CanvasArtifactType,
  storageKey: string,
  localValue: T,
  fallback: T,
  validate: (value: unknown) => value is T,
): Promise<T> {
  try {
    const response = await canvasApi.getArtifact(canvasId, type);
    const server = response.data.data as { exists?: boolean; value?: unknown } | undefined;
    if (isDirty(storageKey) || (!server?.exists && hasStoredValue(storageKey))) {
      const latestLocalValue = readStored(storageKey, localValue, validate);
      await canvasApi.saveArtifact(canvasId, type, latestLocalValue);
      try {
        if (localStorage.getItem(storageKey) === JSON.stringify(latestLocalValue)) clearDirty(storageKey);
      } catch {
        // Leave dirty so a later load retries.
      }
      return latestLocalValue;
    }
    if (server?.exists && validate(server.value)) {
      writeStored(storageKey, server.value);
      return server.value;
    }
    return fallback;
  } catch {
    return localValue;
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

  useEffect(() => {
    if (!canvasId) {
      setValue(fallback);
      return;
    }
    let cancelled = false;
    const storageKey = `${storageKeyPrefix}${canvasId}`;
    const localValue = readStored(storageKey, fallback, validate);
    setValue(localValue);
    void reconcileWithServer(canvasId, type, storageKey, localValue, fallback, validate).then((next) => {
      if (!cancelled) setValue(next);
    });
    return () => {
      cancelled = true;
    };
  }, [canvasId, fallback, storageKeyPrefix, type, validate]);

  const updateValue = useCallback(
    (updater: T | ((previous: T) => T)) => {
      if (!canvasId) return;
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

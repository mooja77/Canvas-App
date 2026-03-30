/**
 * Cross-Canvas Reference Links — lightweight localStorage-based system.
 *
 * Stores references as: { [nodeId]: { canvasId, canvasName } }
 * under the key `qualcanvas-cross-refs`.
 */

const STORAGE_KEY = 'qualcanvas-cross-refs';

export interface CrossCanvasRef {
  canvasId: string;
  canvasName: string;
}

type CrossCanvasRefMap = Record<string, CrossCanvasRef>;

function getAll(): CrossCanvasRefMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CrossCanvasRefMap) : {};
  } catch {
    return {};
  }
}

function saveAll(map: CrossCanvasRefMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getCrossCanvasRef(nodeId: string): CrossCanvasRef | null {
  const map = getAll();
  return map[nodeId] ?? null;
}

export function setCrossCanvasRef(nodeId: string, ref: CrossCanvasRef): void {
  const map = getAll();
  map[nodeId] = ref;
  saveAll(map);
}

export function removeCrossCanvasRef(nodeId: string): void {
  const map = getAll();
  delete map[nodeId];
  saveAll(map);
}

export function getAllCrossCanvasRefs(): CrossCanvasRefMap {
  return getAll();
}

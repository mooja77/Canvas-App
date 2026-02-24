import { useState, useEffect, useRef } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import toast from 'react-hot-toast';

interface AnnotationPopoverProps {
  codingId: string;
  currentAnnotation?: string | null;
  onClose: () => void;
  anchorRect?: { top: number; left: number };
}

export default function AnnotationPopover({ codingId, currentAnnotation, onClose, anchorRect }: AnnotationPopoverProps) {
  const { updateCodingAnnotation } = useCanvasStore();
  const [text, setText] = useState(currentAnnotation || '');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCodingAnnotation(codingId, text.trim() || null);
      toast.success('Annotation saved');
      onClose();
    } catch {
      toast.error('Failed to save annotation');
    } finally {
      setSaving(false);
    }
  };

  const style: React.CSSProperties = anchorRect
    ? { position: 'fixed', top: anchorRect.top, left: anchorRect.left, zIndex: 100 }
    : {};

  return (
    <div ref={ref} className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800 w-64" style={style}>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Annotation</label>
      <textarea
        className="input w-full text-xs resize-none"
        rows={3}
        placeholder="Add a researcher note..."
        value={text}
        onChange={e => setText(e.target.value)}
        autoFocus
      />
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary h-6 px-2 text-[10px] disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

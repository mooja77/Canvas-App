import { useState } from 'react';
import { createPortal } from 'react-dom';

interface FilePreviewItem {
  file: File;
  preview: string;
  selected: boolean;
}

interface FilePreviewModalProps {
  files: File[];
  onImport: (files: File[]) => void;
  onClose: () => void;
}

export default function FilePreviewModal({ files, onImport, onClose }: FilePreviewModalProps) {
  const [items, setItems] = useState<FilePreviewItem[]>(
    files.map(f => ({ file: f, preview: '', selected: true }))
  );

  const toggleItem = (idx: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));
  };

  const selectedCount = items.filter(i => i.selected).length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-96 max-h-[80vh] rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Import {files.length} file{files.length > 1 ? 's' : ''}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {items.map((item, idx) => (
            <label
              key={idx}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${item.selected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            >
              <input
                type="checkbox"
                checked={item.selected}
                onChange={() => toggleItem(idx)}
                className="h-3.5 w-3.5 rounded border-gray-300"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{item.file.name}</p>
                <p className="text-[10px] text-gray-400">
                  {(item.file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <span className="text-[10px] text-gray-400 uppercase">
                {item.file.name.split('.').pop()}
              </span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-400">{selectedCount} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button
              onClick={() => onImport(items.filter(i => i.selected).map(i => i.file))}
              disabled={selectedCount === 0}
              className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Import Selected
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

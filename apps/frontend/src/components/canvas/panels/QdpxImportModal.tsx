import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { canvasApi } from '../../../services/api';
import toast from 'react-hot-toast';

interface QdpxImportModalProps {
  canvasId: string;
  onClose: () => void;
  onImported: () => void;
}

export default function QdpxImportModal({ canvasId, onClose, onImported }: QdpxImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await canvasApi.importQdpx(canvasId, formData);
      const data = res.data;
      toast.success(data.message || 'QDPX imported successfully');
      onImported();
      onClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to import QDPX file');
    } finally {
      setImporting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Import QDPX File</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Import a REFI-QDA Project Exchange (.qdpx) file to add codes, sources, and codings to this canvas.
        </p>

        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
              <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Click to select a .qdpx or .zip file</p>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".qdpx,.zip"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

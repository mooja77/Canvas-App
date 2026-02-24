import { useState, useRef, useCallback } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import toast from 'react-hot-toast';

interface ParsedEntry {
  title: string;
  content: string;
}

interface Props {
  onClose: () => void;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): ParsedEntry[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  const entries: ParsedEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 2 || !fields[1]) {
      entries.push({ title: `Row ${i + 1}`, content: fields[0] || '' });
    } else {
      const title = fields[0] || `Row ${i + 1}`;
      const content = fields[1];
      entries.push({ title, content });
    }
  }
  return entries;
}

export default function FileUploadModal({ onClose }: Props) {
  const { addTranscript, refreshCanvas } = useCanvasStore();
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'txt' | 'csv' | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'txt' && ext !== 'csv') {
      toast.error('Only .txt and .csv files are supported');
      return;
    }

    setFileName(file.name);
    setFileType(ext as 'txt' | 'csv');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text?.trim()) {
        toast.error('File is empty');
        return;
      }

      if (ext === 'txt') {
        const title = file.name.replace(/\.txt$/i, '');
        setEntries([{ title, content: text.trim() }]);
      } else {
        const parsed = parseCsv(text);
        if (parsed.length === 0) {
          toast.error('No valid entries found in CSV');
          return;
        }
        setEntries(parsed);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (entries.length === 0) return;
    setImporting(true);
    setProgress(0);

    try {
      for (let i = 0; i < entries.length; i++) {
        await addTranscript(entries[i].title, entries[i].content);
        setProgress(i + 1);
      }
      await refreshCanvas();
      toast.success(`Imported ${entries.length} transcript${entries.length > 1 ? 's' : ''}`);
      onClose();
    } catch {
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-content w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 pb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Upload File</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Import transcripts from .txt or .csv files. CSV files should have title in column 1 and content in column 2.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {entries.length === 0 ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
                dragging
                  ? 'border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-900/20'
                  : 'border-gray-300 hover:border-gray-400 dark:border-gray-600'
              }`}
            >
              <svg className="h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Drag and drop a file here, or
              </p>
              <button
                onClick={() => inputRef.current?.click()}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Browse files
              </button>
              <p className="mt-2 text-xs text-gray-400">Supports .txt and .csv</p>
              <input
                ref={inputRef}
                type="file"
                accept=".txt,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fileName}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    {fileType?.toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => { setEntries([]); setFileName(''); setFileType(null); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Choose different file
                </button>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  {entries.length} transcript{entries.length > 1 ? 's' : ''} to import
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-750">
                  {entries.map((entry, i) => (
                    <div key={i} className="px-3 py-2">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{entry.title}</p>
                      <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{entry.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {importing && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Importing...</span>
                    <span>{progress} / {entries.length}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(progress / entries.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button
            onClick={handleImport}
            disabled={importing || entries.length === 0}
            className="btn-primary text-sm"
          >
            {importing ? `Importing ${progress}/${entries.length}...` : `Import ${entries.length > 0 ? entries.length : ''} Transcript${entries.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

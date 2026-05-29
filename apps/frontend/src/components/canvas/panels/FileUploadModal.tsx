import { useState, useRef, useCallback } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import {
  parseTranscriptFile,
  isSupportedTranscriptFile,
  getExt,
  type ParsedEntry,
} from '../../../utils/transcriptFiles';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import toast from 'react-hot-toast';

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsText(file);
  });
}

// .docx is a binary (zipped XML) format, so we read it as an ArrayBuffer and
// extract plain text with mammoth. mammoth is lazy-imported so it only loads
// the (sizeable) parser when a researcher actually uploads a Word doc.
async function extractFileText(file: File): Promise<string> {
  if (getExt(file.name) === 'docx') {
    const mammoth = (await import('mammoth')).default;
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value;
  }
  return readFileText(file);
}

interface Props {
  onClose: () => void;
}

export default function FileUploadModal({ onClose }: Props) {
  useEscapeToClose(onClose);
  const { addTranscript, refreshCanvas } = useCanvasStore();
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Accept one or many files at once (drop a whole folder of interviews). Each
  // supported file is read + parsed into one or more transcript entries; the
  // results are pooled into a single review list before import.
  const processFiles = useCallback((files: File[]) => {
    const supported = files.filter((f) => isSupportedTranscriptFile(f.name));
    const rejected = files.length - supported.length;
    if (supported.length === 0) {
      toast.error('Supported formats: .docx, .txt, .csv, .vtt, .srt');
      return;
    }
    if (rejected > 0) toast(`Skipped ${rejected} unsupported file${rejected > 1 ? 's' : ''}`);

    Promise.all(supported.map((f) => extractFileText(f).then((text) => ({ name: f.name, text }))))
      .then((read) => {
        const collected: ParsedEntry[] = [];
        const names: string[] = [];
        let emptyCount = 0;
        for (const { name, text } of read) {
          const parsed = parseTranscriptFile(name, text);
          if (parsed.length === 0) {
            emptyCount++;
            continue;
          }
          collected.push(...parsed);
          names.push(name);
        }
        if (collected.length === 0) {
          toast.error('No transcript content found in the selected file(s)');
          return;
        }
        if (emptyCount > 0) toast(`Skipped ${emptyCount} empty file${emptyCount > 1 ? 's' : ''}`);
        setEntries(collected);
        setFileNames(names);
      })
      .catch(() => toast.error('Failed to read one or more files'));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []));
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
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-upload-title"
        className="modal-content w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-3">
          <h3 id="file-upload-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Upload File
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Import transcripts from Word (.docx), .txt, .csv, or subtitle files (.vtt / .srt from Zoom, Otter, Teams) —
            select or drop multiple at once to import a whole folder of interviews. CSV files should have title in
            column 1 and content in column 2.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {entries.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
                dragging
                  ? 'border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-900/20'
                  : 'border-gray-300 hover:border-gray-400 dark:border-gray-600'
              }`}
            >
              <svg
                className="h-10 w-10 text-gray-300 dark:text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Drag and drop files here, or</p>
              <button
                onClick={() => inputRef.current?.click()}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Browse files
              </button>
              <p className="mt-2 text-xs text-gray-400">
                Supports .docx, .txt, .csv, .vtt, .srt — select multiple at once
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".docx,.txt,.csv,.vtt,.srt"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
                    {fileNames.length === 1 ? fileNames[0] : `${fileNames.length} files`}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setEntries([]);
                    setFileNames([]);
                  }}
                  className="shrink-0 text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
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
                    <span>
                      {progress} / {entries.length}
                    </span>
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
          <button onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button onClick={handleImport} disabled={importing || entries.length === 0} className="btn-primary text-sm">
            {importing
              ? `Importing ${progress}/${entries.length}...`
              : `Import ${entries.length > 0 ? entries.length : ''} Transcript${entries.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

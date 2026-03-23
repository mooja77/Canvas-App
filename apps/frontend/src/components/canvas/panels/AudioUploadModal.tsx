import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useFileUpload } from '../../../hooks/useFileUpload';

interface AudioUploadModalProps {
  onTranscribe: (fileUploadId: string, language?: string) => void;
  onClose: () => void;
}

const ACCEPTED_TYPES = '.mp3,.wav,.mp4,.m4a,.ogg,.webm,.flac';

export default function AudioUploadModal({ onTranscribe, onClose }: AudioUploadModalProps) {
  const { uploading, progress, fileUploadId: _fileUploadId, uploadFile } = useFileUpload();
  const [language, setLanguage] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      const result = await uploadFile(file);
      if (result) {
        // Auto-start transcription after upload
        onTranscribe(result.id, language || undefined);
        onClose();
      }
    },
    [uploadFile, language, onTranscribe, onClose],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
            Upload Audio for Transcription
          </h2>
        </div>

        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Upload an audio or video file to transcribe using AI. Supported formats: MP3, WAV, MP4, M4A, OGG, WebM, FLAC.
        </p>

        {/* Drop zone */}
        <div
          className={`mb-3 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <>
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-200 border-t-blue-500" />
              <p className="text-xs text-gray-500">Uploading... {Math.round(progress)}%</p>
              <div className="h-1.5 w-full max-w-48 rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <svg className="h-8 w-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-xs text-gray-400 dark:text-gray-500">Drag & drop audio file here, or</p>
              <label className="cursor-pointer rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
                Browse Files
                <input
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </label>
            </>
          )}
        </div>

        {/* Language selector */}
        <label className="block mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
          Language (optional — auto-detect if empty)
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="">Auto-detect</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="pt">Portuguese</option>
          <option value="zh">Chinese</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="ar">Arabic</option>
        </select>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

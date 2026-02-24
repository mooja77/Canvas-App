import { useState } from 'react';

interface Props {
  onSubmit: (title: string, content: string) => Promise<void>;
  onClose: () => void;
}

export default function TranscriptUploadModal({ onSubmit, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(title.trim(), content.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-content w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl backdrop-blur-xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Transcript</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Paste or type your interview transcript below.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="transcript-title">Title</label>
            <input
              id="transcript-title"
              type="text"
              className="input mt-1"
              placeholder="e.g. Interview #1 — Participant A"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="transcript-content">Transcript Content</label>
            <textarea
              id="transcript-content"
              className="input mt-1 min-h-[200px] resize-y font-mono text-sm"
              placeholder="Paste the full interview transcript here..."
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={10}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={submitting || !title.trim() || !content.trim()} className="btn-primary text-sm">
              {submitting ? 'Adding...' : 'Add Transcript'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

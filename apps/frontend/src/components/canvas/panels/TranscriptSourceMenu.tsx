import { useState, useRef, useEffect } from 'react';
import TranscriptUploadModal from './TranscriptUploadModal';
import ImportNarrativesModal from './ImportNarrativesModal';
import FileUploadModal from './FileUploadModal';
import CrossCanvasImportModal from './CrossCanvasImportModal';
import { useCanvasStore } from '../../../stores/canvasStore';
import toast from 'react-hot-toast';

const SOURCE_OPTIONS = [
  {
    key: 'paste',
    label: 'Paste Text',
    description: 'Type or paste transcript content',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
      </svg>
    ),
    color: '#3B82F6',
  },
  {
    key: 'assessment',
    label: 'From Assessments',
    description: 'Import WISE narrative responses',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
      </svg>
    ),
    color: '#059669',
  },
  {
    key: 'file',
    label: 'Upload File',
    description: 'Import .txt or .csv files',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
      </svg>
    ),
    color: '#D97706',
  },
  {
    key: 'canvas',
    label: 'From Another Canvas',
    description: 'Copy transcripts from your canvases',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
      </svg>
    ),
    color: '#7C3AED',
  },
];

export default function TranscriptSourceMenu() {
  const { addTranscript } = useCanvasStore();
  const [open, setOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (key: string) => {
    setOpen(false);
    setActiveModal(key);
  };

  const handleAddTranscript = async (title: string, content: string) => {
    try {
      await addTranscript(title, content);
      setActiveModal(null);
      toast.success('Transcript added');
    } catch {
      toast.error('Failed to add transcript');
    }
  };

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          data-tour="canvas-btn-transcript"
          onClick={() => setOpen(!open)}
          className="btn-canvas btn-glow-blue flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
          title="Add transcript"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          Transcript
          <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {open && (
          <div className="dropdown-enter absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-gray-200/60 bg-white/95 shadow-node backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95">
            {SOURCE_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => handleSelect(opt.key)}
                className="btn-canvas flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-100 hover:bg-gray-50 dark:hover:bg-gray-750 first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: opt.color + '18', color: opt.color }}>
                  {opt.icon}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{opt.label}</p>
                  <p className="text-[10px] text-gray-400">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeModal === 'paste' && (
        <TranscriptUploadModal onSubmit={handleAddTranscript} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'assessment' && (
        <ImportNarrativesModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'file' && (
        <FileUploadModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'canvas' && (
        <CrossCanvasImportModal onClose={() => setActiveModal(null)} />
      )}
    </>
  );
}

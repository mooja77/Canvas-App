import { useState } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { useUIStore } from '../../../stores/uiStore';
import TranscriptSourceMenu from './TranscriptSourceMenu';
import AutoCodeModal from './AutoCodeModal';
import CaseManagerPanel from './CaseManagerPanel';
import HierarchyPanel from './HierarchyPanel';
import AddComputedNodeMenu from './AddComputedNodeMenu';
import CodebookExportModal from './CodebookExportModal';
import ExcerptBrowserModal from './ExcerptBrowserModal';
import RichExportModal from './RichExportModal';
import ShareCanvasModal from './ShareCanvasModal';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import ProjectDashboard from './ProjectDashboard';
import EthicsCompliancePanel from './EthicsCompliancePanel';
import IntercoderReliabilityModal from './IntercoderReliabilityModal';
import CodeWeightingPanel from './CodeWeightingPanel';
import CanvasSwitcher from './CanvasSwitcher';
import toast from 'react-hot-toast';

interface CanvasToolbarProps {
  showNavigator?: boolean;
  onToggleNavigator?: () => void;
  onOpenCommandPalette?: () => void;
  onAutoLayout?: () => void;
  onExportPNG?: () => void;
  onToggleFocusMode?: () => void;
}

export default function CanvasToolbar({ showNavigator, onToggleNavigator, onOpenCommandPalette, onAutoLayout, onExportPNG, onToggleFocusMode }: CanvasToolbarProps) {
  const { activeCanvas, closeCanvas, addQuestion, addMemo, showCodingStripes, toggleCodingStripes } = useCanvasStore();
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [showAutoCode, setShowAutoCode] = useState(false);
  const [showCaseManager, setShowCaseManager] = useState(false);
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [showCodebook, setShowCodebook] = useState(false);
  const [showExcerpts, setShowExcerpts] = useState(false);
  const [showRichExport, setShowRichExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showEthics, setShowEthics] = useState(false);
  const [showIntercoder, setShowIntercoder] = useState(false);
  const [showWeighting, setShowWeighting] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [addingMemo, setAddingMemo] = useState(false);

  if (!activeCanvas) return null;

  const handleAddQuestion = async () => {
    if (!questionText.trim() || addingQuestion) return;
    setAddingQuestion(true);
    try {
      await addQuestion(questionText.trim());
      setQuestionText('');
      setShowQuestionInput(false);
      toast.success('Question added');
    } catch {
      toast.error('Failed to add question');
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleAddMemo = async () => {
    if (addingMemo) return;
    setAddingMemo(true);
    try {
      await addMemo('New memo — click to edit');
      toast.success('Memo added');
    } catch {
      toast.error('Failed to add memo');
    } finally {
      setAddingMemo(false);
    }
  };

  return (
    <>
      <div data-tour="canvas-toolbar" className="relative z-10 flex items-center justify-between border-b border-gray-200/80 bg-white/90 px-3 py-2 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/90">
        <div className="flex items-center gap-2">
          {/* Navigator toggle */}
          {onToggleNavigator && (
            <button
              onClick={onToggleNavigator}
              className={`rounded-lg p-1.5 transition-colors ${
                showNavigator
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300'
              }`}
              title={showNavigator ? 'Hide navigator' : 'Show navigator'}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            </button>
          )}

          <button
            onClick={closeCanvas}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
            title="Back to canvas list"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            <span className="hidden sm:inline text-xs">Back</span>
          </button>

          {/* Divider */}
          <div className="h-5 w-px bg-gray-200/80 dark:bg-gray-700/80" />

          <CanvasSwitcher canvasName={activeCanvas.name} />
        </div>

        <div className="flex items-center gap-1.5">
          {showQuestionInput ? (
            <div className="flex items-center gap-2 animate-fade-in">
              <input
                type="text"
                className="input h-8 w-64 text-sm"
                placeholder="Type your research question..."
                value={questionText}
                onChange={e => setQuestionText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddQuestion(); if (e.key === 'Escape') setShowQuestionInput(false); }}
                autoFocus
              />
              <button onClick={handleAddQuestion} disabled={!questionText.trim() || addingQuestion} className="btn-primary h-8 px-3 text-xs">
                {addingQuestion ? 'Adding...' : 'Add'}
              </button>
              <button onClick={() => setShowQuestionInput(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors" title="Cancel">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              {/* Data tools */}
              <div className="flex items-center gap-1">
                <TranscriptSourceMenu />
                <button
                  data-tour="canvas-btn-question"
                  onClick={() => setShowQuestionInput(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 transition-colors"
                  title="Add a research question (code) to organize your coding"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                  Code
                </button>
                <button
                  data-tour="canvas-btn-memo"
                  onClick={handleAddMemo}
                  disabled={addingMemo}
                  className="flex items-center gap-1.5 rounded-lg bg-yellow-50 px-2.5 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50 disabled:opacity-50 transition-colors"
                  title="Add a research memo or note"
                >
                  {addingMemo ? (
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  )}
                  Memo
                </button>
              </div>

              {/* Divider */}
              <div className="h-5 w-px bg-gray-200/80 mx-0.5 dark:bg-gray-700/80" />

              {/* Analysis tools */}
              <div className="flex items-center gap-1">
                <button
                  data-tour="canvas-btn-autocode"
                  onClick={() => setShowAutoCode(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition-colors"
                  title="Automatically code transcripts by keyword or pattern"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                  </svg>
                  Auto-Code
                </button>
                <button
                  data-tour="canvas-btn-cases"
                  onClick={() => setShowCaseManager(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                  title="Group transcripts into cases (e.g. by participant)"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  Cases
                </button>
                <button
                  data-tour="canvas-btn-hierarchy"
                  onClick={() => setShowHierarchy(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                  title="View and organize question hierarchy"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                  Hierarchy
                </button>
                <button
                  onClick={() => setShowIntercoder(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                  title="Intercoder reliability (Cohen's Kappa)"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  </svg>
                  Kappa
                </button>
                <button
                  onClick={() => setShowWeighting(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                  title="Rate coding importance/intensity (1-5 stars)"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                  </svg>
                  Weights
                </button>
              </div>

              {/* Divider */}
              <div className="h-5 w-px bg-gray-200/80 mx-0.5 dark:bg-gray-700/80" />

              {/* View tools */}
              <div className="flex items-center gap-1">
                <button
                  data-tour="canvas-btn-stripes"
                  onClick={toggleCodingStripes}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${showCodingStripes
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                  title={showCodingStripes ? 'Hide coding stripes' : 'Show coding stripes'}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                  </svg>
                  Stripes
                </button>
                <button
                  onClick={() => setShowDashboard(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                  title="Project overview dashboard"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
                  </svg>
                  Dashboard
                </button>
                <button
                  onClick={() => setShowEthics(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                  title="Ethics & compliance settings"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                  Ethics
                </button>
                <button
                  onClick={() => setShowExcerpts(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                  title="Browse all coded excerpts"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                  Excerpts
                </button>
                <button
                  onClick={() => setShowCodebook(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                  title="Export codebook"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                  Codebook
                </button>
                {onAutoLayout && (
                  <button
                    onClick={onAutoLayout}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                    title="Auto-arrange canvas layout (Ctrl+Shift+L)"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
                    </svg>
                    Arrange
                  </button>
                )}
                {onExportPNG && (
                  <button
                    onClick={onExportPNG}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                    title="Export canvas as PNG image"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => setShowRichExport(true)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="Export analysis report (HTML/Markdown)"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </button>
                {onToggleFocusMode && (
                  <button
                    onClick={onToggleFocusMode}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                    title="Focus mode (Ctrl+.)"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => setShowShare(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                  title="Share canvas"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                  </svg>
                  Share
                </button>
                {onOpenCommandPalette && (
                  <button
                    onClick={onOpenCommandPalette}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                    title="Command palette (Ctrl+K)"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <kbd className="hidden lg:inline rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 text-[9px] font-mono">Ctrl+K</kbd>
                  </button>
                )}
                <button
                  onClick={() => { useUIStore.getState().resetOnboarding(); }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/30 dark:hover:text-brand-400 transition-colors"
                  title="Replay guided tour"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowShortcuts(true)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="Keyboard shortcuts (?)"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                </button>
              </div>

              {/* Divider */}
              <div className="h-5 w-px bg-gray-200/80 mx-0.5 dark:bg-gray-700/80" />

              {/* Add Query dropdown */}
              <AddComputedNodeMenu />
            </>
          )}
        </div>
      </div>

      {showAutoCode && <AutoCodeModal onClose={() => setShowAutoCode(false)} />}
      {showCaseManager && <CaseManagerPanel onClose={() => setShowCaseManager(false)} />}
      {showHierarchy && <HierarchyPanel onClose={() => setShowHierarchy(false)} />}
      {showCodebook && <CodebookExportModal onClose={() => setShowCodebook(false)} />}
      {showExcerpts && <ExcerptBrowserModal onClose={() => setShowExcerpts(false)} />}
      {showRichExport && <RichExportModal onClose={() => setShowRichExport(false)} />}
      {showShare && <ShareCanvasModal onClose={() => setShowShare(false)} />}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showDashboard && <ProjectDashboard onClose={() => setShowDashboard(false)} />}
      {showEthics && <EthicsCompliancePanel onClose={() => setShowEthics(false)} />}
      {showIntercoder && <IntercoderReliabilityModal onClose={() => setShowIntercoder(false)} />}
      {showWeighting && <CodeWeightingPanel onClose={() => setShowWeighting(false)} />}
    </>
  );
}

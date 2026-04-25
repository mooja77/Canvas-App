import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanvasStore, useActiveCanvas, useShowCodingStripes } from '../../../stores/canvasStore';
import { useUIStore, type EdgeStyleType } from '../../../stores/uiStore';
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
import IntercoderPanel from './IntercoderPanel';
import CodeWeightingPanel from './CodeWeightingPanel';
import CrossCaseAnalysisModal from './CrossCaseAnalysisModal';
import ResearchAssistantPanel from './ResearchAssistantPanel';
import SummaryPanel from './SummaryPanel';
import CanvasSwitcher from './CanvasSwitcher';
import SurveyImportModal from './SurveyImportModal';
import QdpxExportButton from './QdpxExportButton';
import QdpxImportModal from './QdpxImportModal';
import CalendarPanel from './CalendarPanel';
import toast from 'react-hot-toast';
import { canvasApi } from '../../../services/api';
import FeatureTooltip from '../../FeatureTooltip';

/* ── Dropdown helpers ─────────────────────────────────────────────── */

function ToolbarDropdown({
  label,
  icon,
  children,
  className,
  'data-tour': dataTour,
}: {
  label?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  'data-tour'?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" data-tour={dataTour}>
      <button
        onClick={() => setOpen(!open)}
        className={
          className ||
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors'
        }
      >
        {icon}
        {label && <span>{label}</span>}
        <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 sm:right-0 top-full mt-1 z-40 w-56 max-w-[calc(100vw-16px)] rounded-xl bg-white dark:bg-gray-800 shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 py-1.5">
            <div onClick={() => setOpen(false)}>{children}</div>
          </div>
        </>
      )}
    </div>
  );
}

function DropdownItem({
  icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {icon}
      {label}
    </button>
  );
}

function DropdownDivider() {
  return <div className="my-1.5 h-px bg-gray-200 dark:bg-gray-700" />;
}

/* ── Main toolbar ─────────────────────────────────────────────────── */

interface CanvasToolbarProps {
  showNavigator?: boolean;
  onToggleNavigator?: () => void;
  onOpenCommandPalette?: () => void;
  onAutoLayout?: () => void;
  onExportPNG?: () => void;
  onToggleFocusMode?: () => void;
  onTogglePresentationMode?: () => void;
  onAiAutoCode?: () => void;
  requireAiConfig?: (feature: string, callback: () => void) => void;
}

export default function CanvasToolbar({
  showNavigator,
  onToggleNavigator,
  onOpenCommandPalette,
  onAutoLayout,
  onExportPNG,
  onToggleFocusMode,
  onTogglePresentationMode,
  onAiAutoCode,
  requireAiConfig,
}: CanvasToolbarProps) {
  const { t } = useTranslation();
  const activeCanvas = useActiveCanvas();
  const showCodingStripes = useShowCodingStripes();
  const closeCanvas = useCanvasStore((s) => s.closeCanvas);
  const addQuestion = useCanvasStore((s) => s.addQuestion);
  const addMemo = useCanvasStore((s) => s.addMemo);
  const addTranscript = useCanvasStore((s) => s.addTranscript);
  const refreshCanvas = useCanvasStore((s) => s.refreshCanvas);
  const toggleCodingStripes = useCanvasStore((s) => s.toggleCodingStripes);
  const edgeStyle = useUIStore((s) => s.edgeStyle);
  const setEdgeStyle = useUIStore((s) => s.setEdgeStyle);
  const resetOnboarding = useUIStore((s) => s.resetOnboarding);
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
  const [showIntercoderPanel, setShowIntercoderPanel] = useState(false);
  const [showWeighting, setShowWeighting] = useState(false);
  const [showCrossCase, setShowCrossCase] = useState(false);
  const [showResearchAssistant, setShowResearchAssistant] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showSurveyImport, setShowSurveyImport] = useState(false);
  const [showQdpxImport, setShowQdpxImport] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [addingMemo, setAddingMemo] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleExportExcel = async () => {
    if (!activeCanvas) return;
    setExportingExcel(true);
    try {
      const res = await canvasApi.exportExcel(activeCanvas.id);
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeCanvas.name || 'canvas'}-export.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Excel file downloaded');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to export Excel');
    } finally {
      setExportingExcel(false);
    }
  };

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
      <div
        data-tour="canvas-toolbar"
        className="relative z-10 flex flex-wrap items-center justify-between gap-y-1 border-b border-gray-200/80 bg-white/90 px-3 py-2 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/90"
      >
        {/* ── Left side: nav, back, canvas name, data buttons ── */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Navigator toggle */}
          {onToggleNavigator && (
            <button
              onClick={onToggleNavigator}
              className={`shrink-0 rounded-lg p-1.5 transition-colors ${
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
            className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
            title="Back to canvas list"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            <span className="hidden sm:inline text-xs">Back</span>
          </button>

          {/* Divider */}
          <div className="shrink-0 h-5 w-px bg-gray-200/80 dark:bg-gray-700/80" />

          <CanvasSwitcher canvasName={activeCanvas.name} />

          {/* Divider */}
          <div className="shrink-0 h-5 w-px bg-gray-200/80 dark:bg-gray-700/80" />

          {/* Data buttons — always visible */}
          {showQuestionInput ? (
            <div className="flex items-center gap-2 animate-fade-in">
              <input
                type="text"
                className="input h-8 w-64 text-sm"
                placeholder="Type your research question..."
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddQuestion();
                  if (e.key === 'Escape') setShowQuestionInput(false);
                }}
                autoFocus
              />
              <button
                onClick={handleAddQuestion}
                disabled={!questionText.trim() || addingQuestion}
                className="btn-primary h-8 px-3 text-xs"
              >
                {addingQuestion ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => setShowQuestionInput(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Cancel"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <TranscriptSourceMenu />
              <button
                onClick={() => setShowSurveyImport(true)}
                className="flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50 transition-colors"
                title="Import survey responses from CSV"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  />
                </svg>
                {t('toolbar.survey')}
              </button>
              <button
                data-tour="canvas-btn-question"
                onClick={() => setShowQuestionInput(true)}
                className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 transition-colors"
                title="Add a research question (code) to organize your coding"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
                  />
                </svg>
                {t('toolbar.code')}
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                    />
                  </svg>
                )}
                {t('toolbar.memo')}
              </button>
            </div>
          )}
        </div>

        {/* ── Right side: dropdown menus + icon buttons + analyze ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* AI dropdown (purple) */}
          <ToolbarDropdown
            data-tour="canvas-btn-ai"
            label="AI"
            icon={
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                />
              </svg>
            }
            className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 transition-colors"
          >
            <DropdownItem
              data-tour="canvas-btn-autocode"
              icon={
                <svg
                  className="h-4 w-4 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
                  />
                </svg>
              }
              label="Auto-Code"
              onClick={() => setShowAutoCode(true)}
            />
            {onAiAutoCode && (
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                    />
                  </svg>
                }
                label="AI Code"
                onClick={onAiAutoCode}
              />
            )}
            <DropdownItem
              icon={
                <svg
                  className="h-4 w-4 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                  />
                </svg>
              }
              label="AI Chat"
              onClick={() =>
                requireAiConfig
                  ? requireAiConfig('AI Research Assistant', () => setShowResearchAssistant(true))
                  : setShowResearchAssistant(true)
              }
            />
            <DropdownItem
              icon={
                <svg
                  className="h-4 w-4 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
              }
              label="Summarize"
              onClick={() =>
                requireAiConfig ? requireAiConfig('AI Summarization', () => setShowSummary(true)) : setShowSummary(true)
              }
            />
          </ToolbarDropdown>

          {/* Tools dropdown */}
          <FeatureTooltip
            feature="analyzeSeen"
            title="Tools & analysis live here"
            body="Open the Tools menu to try Statistics, Word Cloud, Excerpts, and more."
          >
            <ToolbarDropdown
              label="Tools"
              icon={
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.194-.14 1.743"
                  />
                </svg>
              }
            >
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                    />
                  </svg>
                }
                label="Cases"
                onClick={() => setShowCaseManager(true)}
              />
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.375"
                    />
                  </svg>
                }
                label="Cross-Case"
                onClick={() => setShowCrossCase(true)}
              />
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                    />
                  </svg>
                }
                label="Hierarchy"
                onClick={() => setShowHierarchy(true)}
              />
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                    />
                  </svg>
                }
                label="Kappa (Intercoder)"
                onClick={() => setShowIntercoderPanel(true)}
              />
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                    />
                  </svg>
                }
                label="Weights"
                onClick={() => setShowWeighting(true)}
              />
              <DropdownDivider />
              <DropdownItem
                icon={
                  <svg
                    className={`h-4 w-4 ${showCodingStripes ? 'text-orange-500' : 'text-gray-500'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                  </svg>
                }
                label={showCodingStripes ? 'Hide Coding Stripes' : 'Show Coding Stripes'}
                onClick={toggleCodingStripes}
                active={showCodingStripes}
              />
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
                  </svg>
                }
                label={t('toolbar.dashboard')}
                onClick={() => setShowDashboard(true)}
              />
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                    />
                  </svg>
                }
                label={t('toolbar.ethics')}
                onClick={() => setShowEthics(true)}
              />
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                    />
                  </svg>
                }
                label="Excerpts"
                onClick={() => setShowExcerpts(true)}
              />
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                    />
                  </svg>
                }
                label="Codebook"
                onClick={() => setShowCodebook(true)}
              />
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                    />
                  </svg>
                }
                label="Research Calendar"
                onClick={() => setShowCalendar(true)}
              />
              <DropdownDivider />
              {/* Edge style */}
              <div className="px-3 py-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Edges:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { value: 'bezier' as EdgeStyleType, label: 'Bezier', path: 'M2 10 C8 2, 12 2, 18 10' },
                    { value: 'straight' as EdgeStyleType, label: 'Straight', path: 'M2 10 L18 2' },
                    { value: 'step' as EdgeStyleType, label: 'Step', path: 'M2 10 L2 2 L18 2 L18 10' },
                    {
                      value: 'smoothstep' as EdgeStyleType,
                      label: 'Smooth Step',
                      path: 'M2 10 L2 4 Q2 2 4 2 L16 2 Q18 2 18 4 L18 10',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setEdgeStyle(opt.value)}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors cursor-pointer ${
                        edgeStyle === opt.value
                          ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-900/30 dark:text-brand-300 dark:ring-brand-600'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-600'
                      }`}
                    >
                      <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="shrink-0">
                        <path
                          d={opt.path}
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {onToggleFocusMode && (
                <DropdownItem
                  icon={
                    <svg
                      className="h-4 w-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                      />
                    </svg>
                  }
                  label="Focus Mode"
                  onClick={onToggleFocusMode}
                />
              )}
              {onTogglePresentationMode && (
                <DropdownItem
                  icon={
                    <svg
                      className="h-4 w-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"
                      />
                    </svg>
                  }
                  label="Presentation Mode"
                  onClick={onTogglePresentationMode}
                />
              )}
            </ToolbarDropdown>
          </FeatureTooltip>

          {/* Export dropdown (icon only) */}
          <FeatureTooltip
            feature="exportSeen"
            title="Export your work"
            body="Export to HTML, Markdown, Excel, PNG, or QDPX for NVivo / ATLAS.ti."
          >
            <ToolbarDropdown
              icon={
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  />
                </svg>
              }
            >
              {onExportPNG && (
                <DropdownItem
                  icon={
                    <svg
                      className="h-4 w-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                      />
                    </svg>
                  }
                  label="Export PNG"
                  onClick={onExportPNG}
                />
              )}
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                }
                label="Export Report (HTML/MD)"
                onClick={() => setShowRichExport(true)}
              />
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125"
                    />
                  </svg>
                }
                label={exportingExcel ? 'Exporting...' : 'Export Excel (.xlsx)'}
                onClick={handleExportExcel}
              />
              {/* QDPX Export — rendered inline to use QdpxExportButton's own state */}
              <div className="px-3 py-1">
                <QdpxExportButton canvasId={activeCanvas.id} />
              </div>
              <DropdownItem
                icon={
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                }
                label="QDPX Import"
                onClick={() => setShowQdpxImport(true)}
              />
            </ToolbarDropdown>
          </FeatureTooltip>

          {/* Divider */}
          <div className="h-5 w-px bg-gray-200/80 dark:bg-gray-700/80" />

          {/* Share — kept visible as a primary social action */}
          <button
            onClick={() => setShowShare(true)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
            title="Share canvas"
            aria-label="Share canvas"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
              />
            </svg>
          </button>

          {/* "More" overflow — folds in actions that were previously their
              own buttons but are infrequent (auto-arrange, command palette,
              replay tour, keyboard shortcuts). Keeps the toolbar on one row
              at 1440px so the wrap-to-two-rows layout doesn't happen. */}
          <ToolbarDropdown
            icon={
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
                />
              </svg>
            }
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {onAutoLayout && (
              <DropdownItem
                icon={
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
                    />
                  </svg>
                }
                label="Auto-arrange layout"
                onClick={onAutoLayout}
              />
            )}
            {onOpenCommandPalette && (
              <DropdownItem
                icon={
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                    />
                  </svg>
                }
                label="Command palette  (Ctrl+K)"
                onClick={onOpenCommandPalette}
              />
            )}
            <DropdownItem
              icon={
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"
                  />
                </svg>
              }
              label="Replay guided tour"
              onClick={resetOnboarding}
            />
            <DropdownItem
              icon={
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
                  />
                </svg>
              }
              label="Keyboard shortcuts  (?)"
              onClick={() => setShowShortcuts(true)}
            />
          </ToolbarDropdown>

          {/* Divider */}
          <div className="h-5 w-px bg-gray-200/80 dark:bg-gray-700/80" />

          {/* Analyze button (existing AddComputedNodeMenu) */}
          <AddComputedNodeMenu />
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
      {showIntercoderPanel && <IntercoderPanel onClose={() => setShowIntercoderPanel(false)} />}
      {showWeighting && <CodeWeightingPanel onClose={() => setShowWeighting(false)} />}
      {showCrossCase && <CrossCaseAnalysisModal onClose={() => setShowCrossCase(false)} />}
      {showResearchAssistant && <ResearchAssistantPanel onClose={() => setShowResearchAssistant(false)} />}
      {showSummary && <SummaryPanel onClose={() => setShowSummary(false)} />}
      {showSurveyImport && (
        <SurveyImportModal
          isOpen={showSurveyImport}
          onClose={() => setShowSurveyImport(false)}
          onImport={async (rows) => {
            for (const row of rows) {
              await addTranscript(row.title, row.content);
            }
            toast.success(`Imported ${rows.length} survey response(s)`);
            setShowSurveyImport(false);
          }}
        />
      )}
      {showQdpxImport && (
        <QdpxImportModal
          canvasId={activeCanvas.id}
          onClose={() => setShowQdpxImport(false)}
          onImported={() => {
            refreshCanvas();
            setShowQdpxImport(false);
          }}
        />
      )}
      {showCalendar && <CalendarPanel onClose={() => setShowCalendar(false)} />}
    </>
  );
}

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useActiveCanvas } from '../../../stores/canvasStore';
import { canvasClient } from '../../../services/api';
import toast from 'react-hot-toast';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { AUDIT_EXPORT_PAGE_SIZE, buildAuditCsv, fetchAllAuditEntries, type AuditEntry } from './auditLogExport';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import {
  ethicsReadPayload,
  readEthicsSettings,
  readConsentRecords,
  readAuditEntries,
  readJournalEntries,
} from './ethicsPanelReads';

interface EthicsCompliancePanelProps {
  onClose: () => void;
}

type Tab = 'settings' | 'consent' | 'anonymize' | 'audit' | 'journal';
type ReadTab = Exclude<Tab, 'anonymize'>;

interface EthicsSettings {
  irbNumber: string;
  ethicsStatus: 'pending' | 'approved' | 'expired';
  dataRetentionDate: string;
  checklist: {
    ethicsApproval: boolean;
    consentDocumented: boolean;
    anonymizationCompleted: boolean;
    retentionPeriodSet: boolean;
  };
}

interface ConsentRecord {
  id: string;
  participantId: string;
  consentType: 'informed' | 'verbal' | 'written';
  ethicsProtocol: string;
  notes: string;
  status: 'active' | 'withdrawn';
  createdAt: string;
}

const defaultSettings: EthicsSettings = {
  irbNumber: '',
  ethicsStatus: 'pending',
  dataRetentionDate: '',
  checklist: {
    ethicsApproval: false,
    consentDocumented: false,
    anonymizationCompleted: false,
    retentionPeriodSet: false,
  },
};

/** A reflexivity journal entry as this panel renders it. */
type JournalEntry = { id: string; date: string; content: string; category: string };

/** The API returns createdAt; the panel renders `date`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toJournalEntry = (row: any): JournalEntry => ({
  id: row.id,
  date: row.createdAt ?? row.date,
  content: row.content,
  category: row.category ?? 'general',
});

export default function EthicsCompliancePanel({ onClose }: EthicsCompliancePanelProps) {
  // Keep Tab inside the dialog and give focus back to the trigger on close.
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  useEscapeToClose(onClose);
  const activeCanvas = useActiveCanvas();
  const [tab, setTab] = useState<Tab>('settings');

  // ─── Ethics Settings state ───
  const [settings, setSettings] = useState<EthicsSettings>(defaultSettings);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ─── Consent Registry state ───
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [consentsLoading, setConsentsLoading] = useState(false);
  const [newConsent, setNewConsent] = useState({
    participantId: '',
    consentType: 'informed' as 'informed' | 'verbal' | 'written',
    ethicsProtocol: '',
    notes: '',
  });

  // ─── Anonymization state ───
  const [selectedTranscriptId, setSelectedTranscriptId] = useState('');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);

  // ─── Audit Trail state ───
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditExporting, setAuditExporting] = useState(false);
  const AUDIT_LIMIT = 50;

  // ─── Reflexivity Journal state (localStorage per canvas) ───
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalDraft, setJournalDraft] = useState('');
  const [journalCategory, setJournalCategory] = useState('reflection');
  const [journalLoading, setJournalLoading] = useState(false);
  const participantInput = useRef<HTMLInputElement>(null);
  const journalInput = useRef<HTMLTextAreaElement>(null);
  const [readErrors, setReadErrors] = useState<Partial<Record<ReadTab, boolean>>>({});
  const [verifiedReads, setVerifiedReads] = useState<Partial<Record<ReadTab, string>>>({});
  const readVersions = useRef({ settings: 0, consent: 0, audit: 0, journal: 0 });
  const mounted = useRef(true);

  const canvasId = activeCanvas?.id;
  const currentCanvas = useRef(canvasId);
  currentCanvas.current = canvasId;
  useEffect(() => {
    mounted.current = true;
    const versions = readVersions.current;
    return () => {
      mounted.current = false;
      for (const key of Object.keys(versions) as ReadTab[]) versions[key]++;
    };
  }, []);
  useEffect(() => {
    setSettings(defaultSettings);
    setConsents([]);
    setAuditEntries([]);
    setJournalEntries([]);
    setNewConsent({ participantId: '', consentType: 'informed', ethicsProtocol: '', notes: '' });
    setJournalDraft('');
    setSelectedTranscriptId('');
    setFindText('');
    setReplaceText('');
    setPreviewMode(false);
    setReadErrors({});
    setVerifiedReads({});
  }, [canvasId]);
  const beginRead = useCallback(
    (kind: ReadTab) => {
      const version = ++readVersions.current[kind];
      setReadErrors((prev) => ({ ...prev, [kind]: false }));
      return {
        current: () => mounted.current && currentCanvas.current === canvasId && readVersions.current[kind] === version,
        ready: () => setVerifiedReads((prev) => ({ ...prev, [kind]: canvasId })),
        failed: () => setReadErrors((prev) => ({ ...prev, [kind]: true })),
      };
    },
    [canvasId],
  );
  const readVerified = (kind: ReadTab) => Boolean(canvasId && verifiedReads[kind] === canvasId);

  // ─── Load ethics settings ───
  const loadSettings = useCallback(async () => {
    if (!canvasId) return;
    const read = beginRead('settings');
    setSettingsLoading(true);
    try {
      const res = await canvasClient.get(`/canvas/${canvasId}/ethics`);
      const settings = readEthicsSettings(ethicsReadPayload(res));
      if (!read.current()) return;
      setSettings({ ...settings, checklist: defaultSettings.checklist });
      read.ready();
    } catch {
      if (read.current()) read.failed();
    } finally {
      if (read.current()) setSettingsLoading(false);
    }
  }, [canvasId, beginRead]);

  // ─── Save ethics settings ───
  const saveSettings = async () => {
    if (!canvasId || !readVerified('settings') || readErrors.settings || settingsLoading) return;
    setSettingsSaving(true);
    try {
      await canvasClient.put(`/canvas/${canvasId}/ethics`, {
        ethicsApprovalId: settings.irbNumber,
        ethicsStatus: settings.ethicsStatus,
        dataRetentionDate: settings.dataRetentionDate || null,
      });
      toast.success('Ethics settings saved');
    } catch {
      toast.error('Failed to save ethics settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  // ─── Load consent records ───
  const loadConsents = useCallback(async () => {
    if (!canvasId) return;
    const read = beginRead('consent');
    setConsentsLoading(true);
    try {
      const res = await canvasClient.get(`/canvas/${canvasId}/consent`);
      const records = readConsentRecords(ethicsReadPayload(res), canvasId);
      if (!read.current()) return;
      setConsents(records);
      read.ready();
    } catch {
      if (read.current()) read.failed();
    } finally {
      if (read.current()) setConsentsLoading(false);
    }
  }, [canvasId, beginRead]);

  // ─── Add consent record ───
  const addConsent = async () => {
    if (!readVerified('consent') || readErrors.consent || consentsLoading) return;
    if (!canvasId || !newConsent.participantId.trim()) {
      toast.error('Participant ID is required');
      return;
    }
    try {
      const res = await canvasClient.post(`/canvas/${canvasId}/consent`, newConsent);
      const record = res.data?.data || res.data;
      setConsents((prev) => [...prev, { ...record, status: record.consentStatus || record.status || 'active' }]);
      setNewConsent({ participantId: '', consentType: 'informed', ethicsProtocol: '', notes: '' });
      toast.success('Consent record added');
    } catch {
      toast.error('Failed to add consent record');
    }
  };

  // ─── Withdraw consent ───
  const withdrawConsent = async (consentId: string) => {
    if (!canvasId || !readVerified('consent') || readErrors.consent || consentsLoading) return;
    try {
      await canvasClient.put(`/canvas/${canvasId}/consent/${consentId}/withdraw`);
      setConsents((prev) => prev.map((c) => (c.id === consentId ? { ...c, status: 'withdrawn' } : c)));
      toast.success('Consent withdrawn');
    } catch {
      toast.error('Failed to withdraw consent');
    }
  };

  // ─── Anonymize transcript ───
  const handleAnonymize = async () => {
    if (!canvasId || !selectedTranscriptId || !findText.trim()) {
      toast.error('Select a transcript and enter text to find');
      return;
    }
    setAnonymizing(true);
    try {
      await canvasClient.post(`/canvas/${canvasId}/transcripts/${selectedTranscriptId}/anonymize`, {
        replacements: [{ find: findText, replace: replaceText || '[REDACTED]' }],
      });
      toast.success('Anonymization applied');
      setFindText('');
      setReplaceText('');
      setPreviewMode(false);
    } catch {
      toast.error('Failed to apply anonymization');
    } finally {
      setAnonymizing(false);
    }
  };

  // ─── Load audit trail ───
  // One fetcher for both the table and the export, so the export always
  // honours the filters the researcher can see.
  const fetchAuditPage = useCallback(
    async (offset: number, limit: number): Promise<AuditEntry[]> => {
      const params = new URLSearchParams();
      if (auditDateFrom) params.set('from', auditDateFrom);
      if (auditDateTo) params.set('to', auditDateTo);
      if (auditActionFilter) params.set('action', auditActionFilter);
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      const res = await canvasClient.get(`/audit-log?${params.toString()}`);
      return readAuditEntries(ethicsReadPayload(res));
    },
    [auditDateFrom, auditDateTo, auditActionFilter],
  );

  const loadAuditLog = useCallback(
    async (offset = 0, append = false) => {
      const read = beginRead('audit');
      setAuditLoading(true);
      try {
        const entries = await fetchAuditPage(offset, AUDIT_LIMIT);
        if (!read.current()) return;
        if (append) {
          setAuditEntries((prev) => [...prev, ...entries]);
        } else {
          setAuditEntries(entries);
        }
        setAuditHasMore(entries.length >= AUDIT_LIMIT);
        setAuditOffset(offset + entries.length);
        read.ready();
      } catch {
        if (read.current()) read.failed();
      } finally {
        if (read.current()) setAuditLoading(false);
      }
    },
    [fetchAuditPage, beginRead],
  );

  // ─── Export audit log as CSV ───
  // The table holds only the pages that have been scrolled into view; an audit
  // trail export has to be the whole (filtered) log, so re-read it from the API.
  const exportAuditCsv = async () => {
    setAuditExporting(true);
    try {
      const { entries, truncated } = await fetchAllAuditEntries(fetchAuditPage, {
        pageSize: AUDIT_EXPORT_PAGE_SIZE,
      });
      if (entries.length === 0) {
        toast.error('No audit log entries to export');
        return;
      }
      const blob = new Blob([buildAuditCsv(entries)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        truncated
          ? `Audit log exported (first ${entries.length} entries)`
          : `Audit log exported (${entries.length} entries)`,
      );
    } catch {
      toast.error('Failed to export the audit log');
    } finally {
      setAuditExporting(false);
    }
  };

  // ─── Journal helpers ───
  //
  // Entries are stored server-side. They used to live only in this browser's
  // localStorage, while the panel below promises "an audit trail for your
  // analytical choices" - so they were invisible on another device, absent
  // from exports, and lost with site data.
  const journalKey = canvasId ? `canvas-journal-${canvasId}` : null;

  const loadJournal = useCallback(
    async (migrateLegacy = true) => {
      if (!canvasId) return;
      const read = beginRead('journal');
      setJournalLoading(true);
      try {
        const res = await canvasClient.get(`/canvas/${canvasId}/journal`);
        const serverEntries = readJournalEntries(ethicsReadPayload(res), canvasId);
        if (!read.current()) return;

        // One-time lift of anything this browser still holds locally, so a
        // researcher's existing notes are not stranded by the move.
        let local: JournalEntry[] = [];
        if (migrateLegacy && journalKey) {
          const stored = localStorage.getItem(journalKey);
          if (stored) local = readJournalEntries(JSON.parse(stored), canvasId);
        }

        if (local.length > 0) {
          const existing = new Set(serverEntries.map((e) => e.content));
          const pending = local.filter((e) => !existing.has(e.content));
          for (const entry of pending) {
            if (!read.current()) return;
            try {
              const uploaded = await canvasClient.post(`/canvas/${canvasId}/journal`, {
                content: entry.content,
                category: entry.category,
              });
              readJournalEntries([ethicsReadPayload(uploaded)], canvasId);
            } catch {
              /* keep the local copy if the upload fails - do not drop it */
              if (read.current()) {
                setJournalEntries(serverEntries);
                read.failed();
              }
              return;
            }
          }
          if (!read.current()) return;
          if (pending.length > 0) {
            const refreshed = await canvasClient.get(`/canvas/${canvasId}/journal`);
            const entries = readJournalEntries(ethicsReadPayload(refreshed), canvasId);
            if (!read.current()) return;
            if (pending.some((note) => !entries.some((entry) => entry.content === note.content)))
              throw new Error('Migrated journal notes were not confirmed');
            if (journalKey) localStorage.removeItem(journalKey);
            toast.success(`Moved ${pending.length} journal entr${pending.length === 1 ? 'y' : 'ies'} to your account`);
            setJournalEntries(entries);
            read.ready();
            return;
          }
          if (journalKey) localStorage.removeItem(journalKey);
        }

        setJournalEntries(serverEntries);
        read.ready();
      } catch {
        if (read.current()) read.failed();
      } finally {
        if (read.current()) setJournalLoading(false);
      }
    },
    [canvasId, journalKey, beginRead],
  );

  const saveJournalEntry = useCallback(async () => {
    if (!journalDraft.trim() || !canvasId || verifiedReads.journal !== canvasId || readErrors.journal || journalLoading)
      return;
    try {
      const res = await canvasClient.post(`/canvas/${canvasId}/journal`, {
        content: journalDraft.trim(),
        category: journalCategory,
      });
      setJournalEntries((prev) => [toJournalEntry(res.data.data), ...prev]);
      setJournalDraft('');
      toast.success('Journal entry saved');
    } catch {
      // Previously this toasted success for a localStorage write that no
      // server ever saw. Report the real outcome instead.
      toast.error('Could not save the journal entry');
    }
  }, [journalDraft, journalCategory, canvasId, verifiedReads.journal, readErrors.journal, journalLoading]);

  const deleteJournalEntry = useCallback(
    async (id: string) => {
      if (!canvasId || verifiedReads.journal !== canvasId || readErrors.journal || journalLoading) return;
      try {
        await canvasClient.delete(`/canvas/${canvasId}/journal/${id}`);
        setJournalEntries((prev) => prev.filter((e) => e.id !== id));
      } catch {
        toast.error('Could not delete the journal entry');
      }
    },
    [canvasId, verifiedReads.journal, readErrors.journal, journalLoading],
  );

  // ─── Load data when tab changes ───
  useEffect(() => {
    if (tab === 'settings') loadSettings();
    if (tab === 'consent') loadConsents();
    if (tab === 'audit') {
      setAuditOffset(0);
      loadAuditLog(0);
    }
    if (tab === 'journal') loadJournal();
  }, [tab, loadSettings, loadConsents, loadAuditLog, loadJournal]);

  // ─── Consent summary ───
  const activeConsents = consents.filter((c) => c.status === 'active').length;
  const totalConsents = consents.length;

  // ─── Selected transcript content for anonymization preview ───
  const selectedTranscript = useMemo(() => {
    if (!activeCanvas || !selectedTranscriptId) return null;
    return activeCanvas.transcripts.find((t) => t.id === selectedTranscriptId) || null;
  }, [activeCanvas, selectedTranscriptId]);

  const previewContent = useMemo(() => {
    if (!selectedTranscript || !findText) return null;
    return selectedTranscript.content;
  }, [selectedTranscript, findText]);

  // ─── Status badge helper ───
  const statusBadge = (status: EthicsSettings['ethicsStatus']) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
      approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      expired: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // ─── Tab definitions ───
  const tabs: { key: Tab; label: string }[] = [
    { key: 'settings', label: 'Ethics Settings' },
    { key: 'consent', label: 'Consent Registry' },
    { key: 'anonymize', label: 'Anonymization' },
    { key: 'audit', label: 'Audit Trail' },
    { key: 'journal', label: 'Reflexivity Journal' },
  ];
  const readLabels: Record<ReadTab, string> = {
    settings: 'ethics settings',
    consent: 'consent records',
    audit: 'the audit trail',
    journal: 'journal entries',
  };
  const retryRead = () => {
    if (tab === 'settings') void loadSettings();
    if (tab === 'consent') void loadConsents();
    if (tab === 'audit') void loadAuditLog();
    if (tab === 'journal') void loadJournal(false);
  };
  const currentReadError = tab !== 'anonymize' && readErrors[tab];

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="modal-content w-full max-w-[900px] max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-xl backdrop-blur-xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ethics-compliance-title"
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
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
              <h2 id="ethics-compliance-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Ethics & Compliance
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === t.key
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                      : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded p-1 text-gray-600 hover:text-gray-800 dark:text-gray-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ─── Content ─── */}
        <div className="flex-1 overflow-auto p-4">
          {!canvasId ? (
            <p role="alert" className="mb-4 text-sm text-gray-700 dark:text-gray-300">
              Open a study before viewing its ethics records.
            </p>
          ) : currentReadError ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
            >
              <p className="font-medium">Could not load {readLabels[tab]}.</p>
              <p className="mt-1">
                This is not evidence that your records are empty. Previously loaded records remain visible. Retry
                reloads saved records without repeating an earlier action.
              </p>
              <button
                type="button"
                onClick={retryRead}
                className="mt-2 min-h-[44px] rounded-md border border-current px-3 font-medium"
              >
                Retry loading {readLabels[tab]}
              </button>
            </div>
          ) : null}
          <p className="mb-4 text-xs text-gray-600 dark:text-gray-300">
            <a className="underline" href="/methodology/ethics-in-practice" target="_blank" rel="noreferrer">
              Ethics guidance
            </a>
            {' · '}
            <a className="underline" href="mailto:support@qualcanvas.com">
              Email setup help
            </a>
            {' — '}We can help you organize existing records and adapt your workflow. We reply within two working days.
            No call needed.
          </p>
          {/* ═══════════════ TAB 1: ETHICS SETTINGS ═══════════════ */}
          {tab === 'settings' && (
            <div className="space-y-6">
              {settingsLoading || (!readVerified('settings') && !readErrors.settings) ? (
                <div
                  role="status"
                  aria-label="Loading ethics settings"
                  className="flex items-center justify-center py-12"
                >
                  <svg className="h-5 w-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : readVerified('settings') ? (
                <>
                  {/* IRB Number + Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="ethics-approval-number" className="label">
                        IRB/HREC Approval Number
                      </label>
                      <input
                        id="ethics-approval-number"
                        type="text"
                        className="input text-sm"
                        placeholder="e.g. IRB-2026-0142"
                        value={settings.irbNumber}
                        onChange={(e) => setSettings((s) => ({ ...s, irbNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="ethics-status" className="label">
                        Ethics Status
                      </label>
                      <div className="flex items-center gap-3">
                        <select
                          id="ethics-status"
                          className="input text-sm flex-1"
                          value={settings.ethicsStatus}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              ethicsStatus: e.target.value as EthicsSettings['ethicsStatus'],
                            }))
                          }
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="expired">Expired</option>
                        </select>
                        {statusBadge(settings.ethicsStatus)}
                      </div>
                    </div>
                  </div>

                  {/* Data Retention Date */}
                  <div>
                    <label htmlFor="ethics-retention-date" className="label">
                      Data Retention Date
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-1.5">
                      When should project data be deleted per your ethics protocol?
                    </p>
                    <input
                      id="ethics-retention-date"
                      type="date"
                      className="input text-sm w-64"
                      value={settings.dataRetentionDate}
                      onChange={(e) => setSettings((s) => ({ ...s, dataRetentionDate: e.target.value }))}
                    />
                  </div>

                  {/* Compliance Checklist */}
                  <div>
                    <label className="label">Compliance Checklist</label>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                      This session-only checklist is for your reference, not proof of compliance. Save Settings does not
                      save these ticks.
                    </p>
                    <div className="space-y-2">
                      {[
                        { key: 'ethicsApproval' as const, label: 'Ethics approval recorded' },
                        { key: 'consentDocumented' as const, label: 'Participant consent documented' },
                        { key: 'anonymizationCompleted' as const, label: 'Data anonymization completed' },
                        { key: 'retentionPeriodSet' as const, label: 'Retention period set' },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                            checked={settings.checklist[item.key]}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                checklist: { ...s.checklist, [item.key]: e.target.checked },
                              }))
                            }
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                          {settings.checklist[item.key] && (
                            <svg
                              className="h-4 w-4 text-emerald-500 ml-auto"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={saveSettings}
                      disabled={settingsSaving || Boolean(readErrors.settings)}
                      className="btn-primary text-sm px-6"
                    >
                      {settingsSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ═══════════════ TAB 2: CONSENT REGISTRY ═══════════════ */}
          {tab === 'consent' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center justify-between">
                {readVerified('consent') ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{activeConsents}</span> of{' '}
                    <span className="font-medium text-gray-900 dark:text-gray-100">{totalConsents}</span> participants
                    with active consent
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Saved consent counts are not yet available.
                  </p>
                )}
              </div>

              {/* Add new consent form */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                  Add Consent Record
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ethics-participant-id" className="label text-xs">
                      Participant ID
                    </label>
                    <input
                      id="ethics-participant-id"
                      ref={participantInput}
                      type="text"
                      className="input text-sm"
                      placeholder="e.g. P001"
                      value={newConsent.participantId}
                      onChange={(e) => setNewConsent((c) => ({ ...c, participantId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="ethics-consent-type" className="label text-xs">
                      Consent Type
                    </label>
                    <select
                      id="ethics-consent-type"
                      className="input text-sm"
                      value={newConsent.consentType}
                      onChange={(e) =>
                        setNewConsent((c) => ({
                          ...c,
                          consentType: e.target.value as 'informed' | 'verbal' | 'written',
                        }))
                      }
                    >
                      <option value="informed">Informed</option>
                      <option value="verbal">Verbal</option>
                      <option value="written">Written</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ethics-consent-protocol" className="label text-xs">
                      Ethics Protocol
                    </label>
                    <input
                      id="ethics-consent-protocol"
                      type="text"
                      className="input text-sm"
                      placeholder="e.g. Protocol v2.1"
                      value={newConsent.ethicsProtocol}
                      onChange={(e) => setNewConsent((c) => ({ ...c, ethicsProtocol: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="ethics-consent-notes" className="label text-xs">
                      Notes
                    </label>
                    <input
                      id="ethics-consent-notes"
                      type="text"
                      className="input text-sm"
                      placeholder="Optional notes"
                      value={newConsent.notes}
                      onChange={(e) => setNewConsent((c) => ({ ...c, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={addConsent}
                    disabled={
                      !newConsent.participantId.trim() ||
                      !readVerified('consent') ||
                      Boolean(readErrors.consent) ||
                      consentsLoading
                    }
                    className="btn-primary text-xs px-4 py-1.5"
                  >
                    Add Record
                  </button>
                </div>
              </div>

              {/* Consent table */}
              <div
                role="region"
                aria-label="Consent records"
                tabIndex={0}
                className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-750">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                        Participant ID
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Date</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {consentsLoading ? (
                      <tr>
                        <td
                          colSpan={5}
                          role="status"
                          aria-label="Loading consent records"
                          className="px-3 py-8 text-center text-gray-600"
                        >
                          <svg className="h-5 w-5 animate-spin mx-auto text-gray-400" fill="none" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                        </td>
                      </tr>
                    ) : readErrors.consent && consents.length === 0 ? null : readVerified('consent') &&
                      consents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-gray-700 dark:text-gray-300">
                          <p>No consent records yet.</p>
                          <p className="mt-2">
                            Record permission you have already received so you can find it later. Adding a record does
                            not obtain consent from a participant.
                          </p>
                          <button
                            type="button"
                            className="mt-3 min-h-[44px] rounded-md bg-brand-600 px-4 text-white"
                            onClick={() => participantInput.current?.focus()}
                          >
                            Enter a participant ID
                          </button>
                          <a
                            className="mt-2 block underline"
                            href="/methodology/ethics-in-practice#consent"
                            target="_blank"
                            rel="noreferrer"
                          >
                            See consent guidance
                          </a>
                        </td>
                      </tr>
                    ) : (
                      consents.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-medium">{c.participantId}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 capitalize">{c.consentType}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                c.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              }`}
                            >
                              {c.status === 'active' ? 'Active' : 'Withdrawn'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300 tabular-nums">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {c.status === 'active' && (
                              <button
                                onClick={() => withdrawConsent(c.id)}
                                disabled={consentsLoading || Boolean(readErrors.consent)}
                                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                              >
                                Withdraw
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════════════ TAB 3: ANONYMIZATION TOOL ═══════════════ */}
          {tab === 'anonymize' && (
            <div className="space-y-4">
              {activeCanvas?.transcripts.length === 0 && (
                <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
                  <p>No transcripts to edit yet.</p>
                  <p className="mt-2">
                    Import a transcript, then choose the exact text to find and replace. This tool does not
                    automatically detect names or guarantee that a transcript is anonymous.
                  </p>
                  <button
                    type="button"
                    className="mt-3 min-h-[44px] rounded-md bg-brand-600 px-4 text-white"
                    onClick={() => {
                      onClose();
                      window.dispatchEvent(new CustomEvent('qualcanvas:open-transcript-picker'));
                    }}
                  >
                    Paste or import a transcript
                  </button>
                  <a
                    className="mt-2 block underline"
                    href="/methodology/ethics-in-practice#anonymisation"
                    target="_blank"
                    rel="noreferrer"
                  >
                    See anonymisation guidance
                  </a>
                </div>
              )}
              {/* Warning */}
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800/50 dark:bg-amber-900/20">
                <svg
                  className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
                <div>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Anonymization is irreversible
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Ensure you have a backup of your data before applying anonymization. Changes cannot be undone.
                  </p>
                </div>
              </div>

              {/* Transcript selector */}
              <div>
                <label htmlFor="ethics-anonymize-transcript" className="label">
                  Select Transcript
                </label>
                <select
                  id="ethics-anonymize-transcript"
                  className="input text-sm"
                  value={selectedTranscriptId}
                  onChange={(e) => {
                    setSelectedTranscriptId(e.target.value);
                    setPreviewMode(false);
                  }}
                >
                  <option value="">Choose a transcript...</option>
                  {activeCanvas?.transcripts.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Find and Replace */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ethics-find" className="label">
                    Find
                  </label>
                  <input
                    id="ethics-find"
                    type="text"
                    className="input text-sm"
                    placeholder="Text to find..."
                    value={findText}
                    onChange={(e) => {
                      setFindText(e.target.value);
                      setPreviewMode(false);
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="ethics-replace" className="label">
                    Replace with
                  </label>
                  <input
                    id="ethics-replace"
                    type="text"
                    className="input text-sm"
                    placeholder="e.g. [REDACTED]"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick-replace patterns */}
              <div>
                <label className="label">Quick Replace Patterns</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '[Participant Name]', value: '[Participant Name]' },
                    { label: '[Location]', value: '[Location]' },
                    { label: '[Organization]', value: '[Organization]' },
                  ].map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setReplaceText(p.value)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        replaceText === p.value
                          ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-900/30 dark:text-brand-400'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-650'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview / Apply buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewMode(true)}
                  disabled={!selectedTranscriptId || !findText.trim()}
                  className="btn-secondary text-xs px-4 py-1.5"
                >
                  Preview
                </button>
                <button
                  onClick={handleAnonymize}
                  disabled={!selectedTranscriptId || !findText.trim() || anonymizing}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {anonymizing ? (
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                      />
                    </svg>
                  )}
                  Apply Anonymization
                </button>
              </div>

              {/* Preview area */}
              {previewMode && selectedTranscript && findText && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Preview</h3>
                  <div
                    role="region"
                    aria-label="Anonymization preview"
                    tabIndex={0}
                    className="max-h-64 overflow-auto rounded bg-gray-50 dark:bg-gray-900 p-3 text-xs text-gray-700 dark:text-gray-300 font-mono leading-relaxed whitespace-pre-wrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    {(() => {
                      const content = previewContent || '';
                      const parts: { text: string; highlighted: boolean }[] = [];
                      let lastIndex = 0;
                      const lowerContent = content.toLowerCase();
                      const lowerFind = findText.toLowerCase();

                      if (lowerFind) {
                        let idx = lowerContent.indexOf(lowerFind);
                        while (idx !== -1) {
                          if (idx > lastIndex) {
                            parts.push({ text: content.slice(lastIndex, idx), highlighted: false });
                          }
                          parts.push({ text: replaceText || '[REDACTED]', highlighted: true });
                          lastIndex = idx + findText.length;
                          idx = lowerContent.indexOf(lowerFind, lastIndex);
                        }
                      }
                      if (lastIndex < content.length) {
                        parts.push({ text: content.slice(lastIndex), highlighted: false });
                      }

                      if (parts.length === 0) {
                        return <span className="text-gray-600 dark:text-gray-300 italic">No matches found.</span>;
                      }

                      return parts.map((part, i) =>
                        part.highlighted ? (
                          <mark
                            key={i}
                            className="rounded bg-emerald-200 dark:bg-emerald-800 px-0.5 text-emerald-900 dark:text-emerald-100"
                          >
                            {part.text}
                          </mark>
                        ) : (
                          <span key={i}>{part.text}</span>
                        ),
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ TAB 4: AUDIT TRAIL ═══════════════ */}
          {tab === 'audit' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label htmlFor="ethics-audit-from" className="label text-xs">
                    From
                  </label>
                  <input
                    id="ethics-audit-from"
                    type="date"
                    className="input text-sm w-40"
                    value={auditDateFrom}
                    onChange={(e) => setAuditDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="ethics-audit-to" className="label text-xs">
                    To
                  </label>
                  <input
                    id="ethics-audit-to"
                    type="date"
                    className="input text-sm w-40"
                    value={auditDateTo}
                    onChange={(e) => setAuditDateTo(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="ethics-audit-action" className="label text-xs">
                    Action Type
                  </label>
                  <input
                    id="ethics-audit-action"
                    type="text"
                    className="input text-sm w-40"
                    placeholder="e.g. create, delete"
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => {
                    setAuditOffset(0);
                    loadAuditLog(0);
                  }}
                  className="btn-secondary text-xs px-3 py-2"
                >
                  Filter
                </button>
                <button
                  onClick={exportAuditCsv}
                  disabled={auditEntries.length === 0 || auditExporting || auditLoading || Boolean(readErrors.audit)}
                  className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                  {auditExporting ? 'Exporting...' : 'Export Audit Log'}
                </button>
              </div>

              {/* Audit table */}
              <div
                role="region"
                aria-label="Audit records"
                tabIndex={0}
                className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-750">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Date/Time</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Action</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Resource</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Actor</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {auditLoading && auditEntries.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          role="status"
                          aria-label="Loading the audit trail"
                          className="px-3 py-8 text-center text-gray-600"
                        >
                          <svg className="h-5 w-5 animate-spin mx-auto text-gray-400" fill="none" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                        </td>
                      </tr>
                    ) : readErrors.audit && auditEntries.length === 0 ? null : readVerified('audit') &&
                      auditEntries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-gray-700 dark:text-gray-300">
                          <p>No recorded activity matches these filters.</p>
                          <p className="mt-2">
                            The trail records account activity automatically. An empty result does not mean all previous
                            records were deleted.
                          </p>
                          {auditDateFrom || auditDateTo || auditActionFilter ? (
                            <button
                              type="button"
                              className="mt-3 min-h-[44px] rounded-md bg-brand-600 px-4 text-white"
                              onClick={() => {
                                setAuditDateFrom('');
                                setAuditDateTo('');
                                setAuditActionFilter('');
                              }}
                            >
                              Clear audit filters
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="mt-3 min-h-[44px] rounded-md bg-brand-600 px-4 text-white"
                              onClick={onClose}
                            >
                              Return to your research
                            </button>
                          )}
                          <a
                            className="mt-2 block underline"
                            href="/help/first-code.html"
                            target="_blank"
                            rel="noreferrer"
                          >
                            See a first-coding example
                          </a>
                        </td>
                      </tr>
                    ) : (
                      auditEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 tabular-nums whitespace-nowrap">
                            {new Date(entry.timestamp).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                              {entry.action}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-[150px] truncate">
                            {entry.resource}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{entry.actor}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[200px] truncate">
                            {entry.details}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {auditHasMore && (
                <div className="flex justify-center">
                  <button
                    onClick={() => loadAuditLog(auditOffset, true)}
                    disabled={auditLoading}
                    className="btn-secondary text-xs px-4 py-1.5"
                  >
                    {auditLoading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ TAB 5: REFLEXIVITY JOURNAL ═══════════════ */}
          {tab === 'journal' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 text-amber-500 mt-0.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                    />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                      Researcher Reflexivity Journal
                    </h4>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                      Document your positionality, biases, and decision-making rationale throughout the analysis. This
                      supports research trustworthiness (Lincoln &amp; Guba) and creates an audit trail for your
                      analytical choices.
                    </p>
                  </div>
                </div>
              </div>

              {/* New entry form */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">Category:</span>
                  <div className="flex flex-wrap gap-1" role="group" aria-label="Journal category">
                    {[
                      { value: 'reflection', label: 'Reflection', color: '#8B5CF6' },
                      { value: 'positionality', label: 'Positionality', color: '#3B82F6' },
                      { value: 'decision', label: 'Decision', color: '#10B981' },
                      { value: 'bias', label: 'Bias Check', color: '#F59E0B' },
                      { value: 'methodological', label: 'Method Note', color: '#EF4444' },
                    ].map((cat) => (
                      <button
                        key={cat.value}
                        aria-pressed={journalCategory === cat.value}
                        onClick={() => setJournalCategory(cat.value)}
                        className={`min-h-8 rounded-full px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:text-gray-200 transition-colors border ${
                          journalCategory === cat.value ? 'shadow-sm' : ''
                        }`}
                        style={{
                          borderColor: cat.color + '60',
                          backgroundColor: journalCategory === cat.value ? cat.color + '15' : 'transparent',
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={journalInput}
                  aria-label="Journal note"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none resize-none transition-colors"
                  rows={3}
                  placeholder="Write your journal entry... (e.g., 'I noticed I was drawn to participant stories that align with my own experience. Need to actively seek disconfirming evidence.')"
                  value={journalDraft}
                  onChange={(e) => setJournalDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) saveJournalEntry();
                  }}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-gray-600 dark:text-gray-300">Ctrl+Enter to save</span>
                  <button
                    onClick={saveJournalEntry}
                    disabled={
                      !journalDraft.trim() || !readVerified('journal') || Boolean(readErrors.journal) || journalLoading
                    }
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Save Entry
                  </button>
                </div>
              </div>

              {/* Journal entries */}
              <div className="space-y-2">
                {journalLoading ? (
                  <p role="status" className="py-4 text-sm text-gray-600 dark:text-gray-300">
                    Loading journal entries…
                  </p>
                ) : readErrors.journal && journalEntries.length === 0 ? null : readVerified('journal') &&
                  journalEntries.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-700 dark:text-gray-300">No journal entries yet.</p>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      Keep short notes about your choices and assumptions so you can explain how you reached a finding.
                    </p>
                    <button
                      type="button"
                      className="mt-3 min-h-[44px] rounded-md bg-brand-600 px-4 text-sm text-white"
                      onClick={() => journalInput.current?.focus()}
                    >
                      Start a journal note
                    </button>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                      Example: I checked whether my own experience was affecting which passages I noticed.
                    </p>
                  </div>
                ) : (
                  journalEntries.map((entry) => {
                    const catColors: Record<string, string> = {
                      reflection: '#8B5CF6',
                      positionality: '#3B82F6',
                      decision: '#10B981',
                      bias: '#F59E0B',
                      methodological: '#EF4444',
                    };
                    const color = catColors[entry.category] || '#6B7280';
                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-gray-100 dark:border-gray-700 p-3 group hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200"
                            style={{ backgroundColor: color + '15' }}
                          >
                            {entry.category}
                          </span>
                          <span className="text-[10px] text-gray-600 dark:text-gray-300 tabular-nums">
                            {new Date(entry.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <button
                            onClick={() => deleteJournalEntry(entry.id)}
                            disabled={journalLoading || Boolean(readErrors.journal)}
                            aria-label="Delete journal entry"
                            className="ml-auto inline-flex min-h-8 min-w-8 items-center justify-center rounded text-gray-600 hover:text-red-700 dark:text-gray-300"
                            title="Delete entry"
                          >
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {entry.content}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Export journal */}
              {journalEntries.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      const text = journalEntries
                        .map(
                          (e) => `[${e.category.toUpperCase()}] ${new Date(e.date).toLocaleString()}\n${e.content}\n`,
                        )
                        .join('\n---\n\n');
                      const blob = new Blob([text], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `reflexivity-journal-${new Date().toISOString().split('T')[0]}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Journal exported');
                    }}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                      />
                    </svg>
                    Export Journal
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback, useMemo } from 'react';

interface SurveyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: { title: string; content: string; caseId?: string }[]) => void;
}

interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

/**
 * Simple CSV parser matching the backend's csvParser.ts logic.
 */
function parseCSV(content: string): ParsedCSV {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' && current.length === 0) {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = '';
        i++;
      } else if (ch === '\n') {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };

  return {
    headers: rows[0],
    rows: rows.slice(1).filter(r => r.some(cell => cell.length > 0)),
  };
}

export default function SurveyImportModal({ isOpen, onClose, onImport }: SurveyImportModalProps) {
  const [csvContent, setCsvContent] = useState('');
  const [titleColumn, setTitleColumn] = useState('');
  const [contentColumn, setContentColumn] = useState('');
  const [caseColumn, setCaseColumn] = useState('');
  const [error, setError] = useState('');

  const parsed = useMemo(() => {
    if (!csvContent) return null;
    try {
      return parseCSV(csvContent);
    } catch {
      return null;
    }
  }, [csvContent]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);

      // Auto-detect columns
      const result = parseCSV(text);
      if (result.headers.length > 0) {
        const headers = result.headers.map(h => h.toLowerCase());
        const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('name') || h.includes('id'));
        const contentIdx = headers.findIndex(h => h.includes('content') || h.includes('response') || h.includes('text') || h.includes('answer'));
        const caseIdx = headers.findIndex(h => h.includes('case') || h.includes('group') || h.includes('category'));

        if (titleIdx >= 0) setTitleColumn(result.headers[titleIdx]);
        if (contentIdx >= 0) setContentColumn(result.headers[contentIdx]);
        if (caseIdx >= 0) setCaseColumn(result.headers[caseIdx]);
      }
    };
    reader.readAsText(file);
  }, []);

  const previewRows = useMemo(() => {
    if (!parsed || !titleColumn || !contentColumn) return [];

    const titleIdx = parsed.headers.indexOf(titleColumn);
    const contentIdx = parsed.headers.indexOf(contentColumn);
    const caseIdx = caseColumn ? parsed.headers.indexOf(caseColumn) : -1;

    if (titleIdx === -1 || contentIdx === -1) return [];

    return parsed.rows.slice(0, 5).map((row, i) => ({
      title: row[titleIdx] || `Response ${i + 1}`,
      content: (row[contentIdx] || '').slice(0, 100) + ((row[contentIdx] || '').length > 100 ? '...' : ''),
      caseId: caseIdx >= 0 ? row[caseIdx] : undefined,
    }));
  }, [parsed, titleColumn, contentColumn, caseColumn]);

  const handleImport = useCallback(() => {
    if (!parsed || !titleColumn || !contentColumn) {
      setError('Please select title and content columns');
      return;
    }

    const titleIdx = parsed.headers.indexOf(titleColumn);
    const contentIdx = parsed.headers.indexOf(contentColumn);
    const caseIdx = caseColumn ? parsed.headers.indexOf(caseColumn) : -1;

    if (titleIdx === -1 || contentIdx === -1) {
      setError('Selected columns not found');
      return;
    }

    const rows = parsed.rows
      .map((row, i) => ({
        title: row[titleIdx] || `Response ${i + 1}`,
        content: row[contentIdx] || '',
        ...(caseIdx >= 0 && row[caseIdx] ? { caseId: row[caseIdx] } : {}),
      }))
      .filter(r => r.content.length > 0);

    if (rows.length === 0) {
      setError('No valid rows found');
      return;
    }

    onImport(rows);
    onClose();
  }, [parsed, titleColumn, contentColumn, caseColumn, onImport, onClose]);

  const handleReset = useCallback(() => {
    setCsvContent('');
    setTitleColumn('');
    setContentColumn('');
    setCaseColumn('');
    setError('');
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Import Survey Data (CSV)
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Upload CSV File
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300 hover:file:bg-blue-100"
            />
          </div>

          {/* Column mapping */}
          {parsed && parsed.headers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Found {parsed.rows.length} rows with {parsed.headers.length} columns.
                Map the columns below:
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Title Column *
                  </label>
                  <select
                    value={titleColumn}
                    onChange={(e) => setTitleColumn(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="">Select...</option>
                    {parsed.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Content Column *
                  </label>
                  <select
                    value={contentColumn}
                    onChange={(e) => setContentColumn(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="">Select...</option>
                    {parsed.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Case Column (optional)
                  </label>
                  <select
                    value={caseColumn}
                    onChange={(e) => setCaseColumn(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="">None</option>
                    {parsed.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {previewRows.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preview (first 5 rows)
              </h3>
              <div className="border border-gray-200 dark:border-gray-600 rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="px-3 py-1.5 text-left text-gray-600 dark:text-gray-400">Title</th>
                      <th className="px-3 py-1.5 text-left text-gray-600 dark:text-gray-400">Content</th>
                      {caseColumn && (
                        <th className="px-3 py-1.5 text-left text-gray-600 dark:text-gray-400">Case</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200 font-medium">{row.title}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{row.content}</td>
                        {caseColumn && (
                          <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{row.caseId || '-'}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed && parsed.rows.length > 5 && (
                <p className="text-xs text-gray-500 mt-1">
                  ...and {parsed.rows.length - 5} more rows
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Reset
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!parsed || !titleColumn || !contentColumn}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import {parsed ? `${parsed.rows.length} rows` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

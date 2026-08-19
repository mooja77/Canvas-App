import type { CanvasQuestion, CanvasTextCoding, CanvasTranscript, CanvasCase, CanvasMemo } from '@qualcanvas/shared';

export type GroupBy = 'code' | 'source' | 'case';

export interface ReportInput {
  canvasName: string;
  date: string;
  questions: CanvasQuestion[];
  transcripts: CanvasTranscript[];
  codings: CanvasTextCoding[];
  cases: CanvasCase[];
  memos: CanvasMemo[];
  groupBy: GroupBy;
  includeCodebook: boolean;
  includeExcerpts: boolean;
  includeMemos: boolean;
  includeSummary: boolean;
  includeCoverage: boolean;
}

export function escHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface Derived {
  questionMap: Map<string, CanvasQuestion>;
  transcriptMap: Map<string, CanvasTranscript>;
  coverage: Map<string, { coded: number; total: number; pct: number }>;
}

function derive(input: ReportInput): Derived {
  const questionMap = new Map<string, CanvasQuestion>();
  input.questions.forEach((q) => questionMap.set(q.id, q));

  const transcriptMap = new Map<string, CanvasTranscript>();
  input.transcripts.forEach((t) => transcriptMap.set(t.id, t));

  const coverage = new Map<string, { coded: number; total: number; pct: number }>();
  input.transcripts.forEach((t: CanvasTranscript) => {
    const tCodings = input.codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id);
    const codedChars = new Set<number>();
    tCodings.forEach((c: CanvasTextCoding) => {
      for (let i = c.startOffset; i < c.endOffset; i++) codedChars.add(i);
    });
    const pct = t.content.length > 0 ? Math.round((codedChars.size / t.content.length) * 100) : 0;
    coverage.set(t.id, { coded: codedChars.size, total: t.content.length, pct });
  });

  return { questionMap, transcriptMap, coverage };
}

/** Transcripts grouped by case, in the order the report renders them. */
function caseGroupsOf(input: ReportInput) {
  const uncased = input.transcripts.filter((t) => !t.caseId);
  const groups = input.cases.map((c) => ({
    case: c as CanvasCase | null,
    transcripts: input.transcripts.filter((t: CanvasTranscript) => t.caseId === c.id),
  }));
  return [...groups, { case: null as CanvasCase | null, transcripts: uncased }];
}

function overallCoverage(coverage: Derived['coverage']): number {
  let totalCoded = 0;
  let totalChars = 0;
  coverage.forEach((v) => {
    totalCoded += v.coded;
    totalChars += v.total;
  });
  return totalChars > 0 ? Math.round((totalCoded / totalChars) * 100) : 0;
}

const wordCountOf = (content: string) => content.split(/\s+/).filter(Boolean).length;

/**
 * Markdown blockquote. A quote only reads as a quote while every line carries
 * the ">" marker: an excerpt that spans a blank line otherwise breaks out of
 * the quote half-way through and the attribution detaches from it.
 */
export function blockquote(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? `> ${line}` : '>'))
    .join('\n');
}

// ─── HTML ───

export function generateReportHtml(input: ReportInput): string {
  const { questions, transcripts, codings, memos, canvasName: name, date } = input;
  const { questionMap, transcriptMap, coverage } = derive(input);
  const totalWords = transcripts.reduce((sum, t) => sum + wordCountOf(t.content), 0);

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHTML(name)} — Analysis Report</title>
<style>
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; color: #1f2937; line-height: 1.6; }
  h1 { font-size: 24px; border-bottom: 2px solid #6366f1; padding-bottom: 8px; color: #111827; }
  h2 { font-size: 18px; margin-top: 32px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  h3 { font-size: 14px; margin-top: 20px; color: #4b5563; }
  .meta { color: #6b7280; font-size: 13px; margin-top: 4px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .summary-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
  .summary-card .number { font-size: 24px; font-weight: 700; color: #111827; }
  .summary-card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .code-badge { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .code-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .excerpt { margin: 8px 0; padding: 10px 14px; background: #f9fafb; border-left: 3px solid #6366f1; border-radius: 0 6px 6px 0; font-size: 13px; }
  .excerpt .source { font-size: 11px; color: #9ca3af; margin-top: 4px; }
  .annotation { margin: 4px 0 0 14px; padding: 6px 10px; background: #fffbeb; border-left: 2px solid #f59e0b; font-size: 12px; color: #92400e; border-radius: 0 4px 4px 0; }
  .coverage-bar { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; width: 120px; display: inline-block; vertical-align: middle; }
  .coverage-fill { height: 100%; border-radius: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { background: #f9fafb; font-weight: 600; color: #4b5563; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .memo-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin: 8px 0; }
  .memo-title { font-weight: 600; font-size: 13px; color: #92400e; }
  .memo-content { font-size: 13px; color: #78350f; margin-top: 4px; white-space: pre-wrap; }
  .page-break { page-break-before: always; }
  @media print { body { padding: 20px; } .page-break { page-break-before: always; } }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
<h1>${escHTML(name)}</h1>
<p class="meta">Generated on ${date}</p>
`;

  // Summary section
  if (input.includeSummary) {
    const overallPct = overallCoverage(coverage);

    html += `
<h2>Project Summary</h2>
<div class="summary-grid">
  <div class="summary-card"><div class="number">${transcripts.length}</div><div class="label">Sources</div></div>
  <div class="summary-card"><div class="number">${questions.length}</div><div class="label">Codes</div></div>
  <div class="summary-card"><div class="number">${codings.length}</div><div class="label">Excerpts</div></div>
  <div class="summary-card"><div class="number">${overallPct}%</div><div class="label">Coverage</div></div>
</div>
<p class="meta">${totalWords.toLocaleString()} total words across ${transcripts.length} transcript${transcripts.length !== 1 ? 's' : ''}</p>
`;
  }

  // Coverage table
  if (input.includeCoverage && transcripts.length > 0) {
    html += `<h2>Source Coverage</h2><table><thead><tr><th>Source</th><th>Words</th><th>Coverage</th><th>Codes Applied</th></tr></thead><tbody>`;
    transcripts.forEach((t: CanvasTranscript) => {
      const pct = coverage.get(t.id)?.pct ?? 0;
      const wordCount = wordCountOf(t.content);
      const codeCount = new Set(
        codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id).map((c) => c.questionId),
      ).size;
      const barColor = pct < 30 ? '#f59e0b' : pct < 70 ? '#3b82f6' : '#10b981';
      html += `<tr><td>${escHTML(t.title)}</td><td>${wordCount.toLocaleString()}</td><td><div class="coverage-bar"><div class="coverage-fill" style="width:${pct}%;background:${barColor}"></div></div> ${pct}%</td><td>${codeCount}</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  // Codebook section
  if (input.includeCodebook) {
    html += `<h2>Codebook</h2><table><thead><tr><th>Code</th><th>Parent Theme</th><th>Frequency</th><th>Coverage</th></tr></thead><tbody>`;
    const totalChars = transcripts.reduce((s, t) => s + t.content.length, 0);
    questions.forEach((q: CanvasQuestion) => {
      const qCodings = codings.filter((c: CanvasTextCoding) => c.questionId === q.id);
      const codedChars = qCodings.reduce((s, c) => s + (c.endOffset - c.startOffset), 0);
      const covPct = totalChars > 0 ? Math.round((codedChars / totalChars) * 1000) / 10 : 0;
      const parentQ = q.parentQuestionId ? questionMap.get(q.parentQuestionId) : null;
      html += `<tr><td><span class="code-badge"><span class="code-dot" style="background:${q.color}"></span>${escHTML(q.text)}</span></td><td>${parentQ ? escHTML(parentQ.text) : '—'}</td><td>${qCodings.length}</td><td>${covPct}%</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  // Excerpts section
  if (input.includeExcerpts) {
    html += `<div class="page-break"></div><h2>Coded Excerpts</h2>`;

    if (input.groupBy === 'code') {
      questions.forEach((q: CanvasQuestion) => {
        const qCodings = codings.filter((c: CanvasTextCoding) => c.questionId === q.id);
        if (qCodings.length === 0) return;
        html += `<h3><span class="code-dot" style="background:${q.color}"></span> ${escHTML(q.text)} <span style="color:#9ca3af;font-weight:400">(${qCodings.length})</span></h3>`;
        qCodings.forEach((c: CanvasTextCoding) => {
          const t = transcriptMap.get(c.transcriptId);
          html += `<div class="excerpt">&ldquo;${escHTML(c.codedText)}&rdquo;<div class="source">${escHTML(t?.title || 'Unknown')}</div></div>`;
          if (c.annotation) html += `<div class="annotation">${escHTML(c.annotation)}</div>`;
        });
      });
    } else if (input.groupBy === 'source') {
      transcripts.forEach((t: CanvasTranscript) => {
        const tCodings = codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id);
        if (tCodings.length === 0) return;
        html += `<h3>${escHTML(t.title)} <span style="color:#9ca3af;font-weight:400">(${tCodings.length} excerpt${tCodings.length !== 1 ? 's' : ''})</span></h3>`;
        tCodings.forEach((c: CanvasTextCoding) => {
          const q = questionMap.get(c.questionId);
          html += `<div class="excerpt" style="border-left-color:${q?.color || '#6366f1'}">&ldquo;${escHTML(c.codedText)}&rdquo;<div class="source"><span class="code-badge"><span class="code-dot" style="background:${q?.color || '#888'}"></span>${escHTML(q?.text || 'Unknown')}</span></div></div>`;
          if (c.annotation) html += `<div class="annotation">${escHTML(c.annotation)}</div>`;
        });
      });
    } else {
      // Group by case
      caseGroupsOf(input).forEach((group) => {
        if (group.transcripts.length === 0) return;
        const tIds = new Set(group.transcripts.map((t) => t.id));
        const caseCodings = codings.filter((c: CanvasTextCoding) => tIds.has(c.transcriptId));
        if (caseCodings.length === 0) return;
        html += `<h3>${group.case ? escHTML(group.case.name) : 'Uncategorized'} <span style="color:#9ca3af;font-weight:400">(${caseCodings.length} excerpt${caseCodings.length !== 1 ? 's' : ''})</span></h3>`;
        caseCodings.forEach((c: CanvasTextCoding) => {
          const q = questionMap.get(c.questionId);
          const t = transcriptMap.get(c.transcriptId);
          html += `<div class="excerpt" style="border-left-color:${q?.color || '#6366f1'}">&ldquo;${escHTML(c.codedText)}&rdquo;<div class="source">${escHTML(t?.title || 'Unknown')} · <span class="code-badge"><span class="code-dot" style="background:${q?.color || '#888'}"></span>${escHTML(q?.text || 'Unknown')}</span></div></div>`;
          if (c.annotation) html += `<div class="annotation">${escHTML(c.annotation)}</div>`;
        });
      });
    }
  }

  // Memos section
  if (input.includeMemos && memos.length > 0) {
    html += `<div class="page-break"></div><h2>Research Memos</h2>`;
    memos.forEach((m: CanvasMemo) => {
      html += `<div class="memo-card"><div class="memo-title">${escHTML(m.title || 'Memo')}</div><div class="memo-content">${escHTML(m.content)}</div></div>`;
    });
  }

  html += `
<div class="footer">
  <p>Generated by QualCanvas &middot; ${date}</p>
</div>
</body></html>`;

  return html;
}

// ─── Markdown ───

export function generateReportMarkdown(input: ReportInput): string {
  const { questions, transcripts, codings, memos, canvasName: name, date } = input;
  const { questionMap, transcriptMap, coverage } = derive(input);
  let md = `# ${name}\n\n*Generated on ${date}*\n\n`;

  if (input.includeSummary) {
    const overallPct = overallCoverage(coverage);
    md += `## Project Summary\n\n| Metric | Value |\n|--------|-------|\n| Sources | ${transcripts.length} |\n| Codes | ${questions.length} |\n| Excerpts | ${codings.length} |\n| Coverage | ${overallPct}% |\n\n`;
  }

  if (input.includeCoverage && transcripts.length > 0) {
    md += `## Source Coverage\n\n| Source | Words | Coverage | Codes |\n|--------|-------|----------|-------|\n`;
    transcripts.forEach((t: CanvasTranscript) => {
      const pct = coverage.get(t.id)?.pct ?? 0;
      const wordCount = wordCountOf(t.content);
      const codeCount = new Set(
        codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id).map((c) => c.questionId),
      ).size;
      md += `| ${t.title} | ${wordCount.toLocaleString()} | ${pct}% | ${codeCount} |\n`;
    });
    md += '\n';
  }

  if (input.includeCodebook) {
    md += `## Codebook\n\n| Code | Parent Theme | Frequency |\n|------|-------------|------------|\n`;
    questions.forEach((q: CanvasQuestion) => {
      const count = codings.filter((c: CanvasTextCoding) => c.questionId === q.id).length;
      const parentQ = q.parentQuestionId ? questionMap.get(q.parentQuestionId) : null;
      md += `| ${q.text} | ${parentQ?.text || '—'} | ${count} |\n`;
    });
    md += '\n';
  }

  if (input.includeExcerpts) {
    md += `## Coded Excerpts\n\n`;
    if (input.groupBy === 'code') {
      questions.forEach((q: CanvasQuestion) => {
        const qCodings = codings.filter((c: CanvasTextCoding) => c.questionId === q.id);
        if (qCodings.length === 0) return;
        md += `### ${q.text} (${qCodings.length})\n\n`;
        qCodings.forEach((c: CanvasTextCoding) => {
          const t = transcriptMap.get(c.transcriptId);
          md += `${blockquote(`"${c.codedText}"`)}\n> — *${t?.title || 'Unknown'}*\n\n`;
          if (c.annotation) md += `*Note: ${c.annotation}*\n\n`;
        });
      });
    } else if (input.groupBy === 'source') {
      transcripts.forEach((t: CanvasTranscript) => {
        const tCodings = codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id);
        if (tCodings.length === 0) return;
        md += `### ${t.title} (${tCodings.length} excerpt${tCodings.length !== 1 ? 's' : ''})\n\n`;
        tCodings.forEach((c: CanvasTextCoding) => {
          const q = questionMap.get(c.questionId);
          md += `${blockquote(`"${c.codedText}"`)}\n> — *[${q?.text || 'Unknown'}]*\n\n`;
          if (c.annotation) md += `*Note: ${c.annotation}*\n\n`;
        });
      });
    } else {
      caseGroupsOf(input).forEach((group) => {
        if (group.transcripts.length === 0) return;
        const tIds = new Set(group.transcripts.map((t) => t.id));
        const caseCodings = codings.filter((c: CanvasTextCoding) => tIds.has(c.transcriptId));
        if (caseCodings.length === 0) return;
        md += `### ${group.case?.name || 'Uncategorized'} (${caseCodings.length} excerpt${caseCodings.length !== 1 ? 's' : ''})\n\n`;
        caseCodings.forEach((c: CanvasTextCoding) => {
          const q = questionMap.get(c.questionId);
          const t = transcriptMap.get(c.transcriptId);
          md += `${blockquote(`"${c.codedText}"`)}\n> — *${t?.title || 'Unknown'}* · [${q?.text || 'Unknown'}]\n\n`;
          // Annotations are part of the analytic record, exactly as in the
          // group-by-code and group-by-source branches.
          if (c.annotation) md += `*Note: ${c.annotation}*\n\n`;
        });
      });
    }
  }

  if (input.includeMemos && memos.length > 0) {
    md += `## Research Memos\n\n`;
    memos.forEach((m: CanvasMemo) => {
      md += `### ${m.title || 'Memo'}\n\n${m.content}\n\n---\n\n`;
    });
  }

  md += `\n---\n*Generated by QualCanvas · ${date}*\n`;
  return md;
}

// ─── Word (.docx) ───

/**
 * Real .docx via the `docx` package, mirroring the HTML report's sections.
 * Dynamically imported so the library only loads when a Word export runs.
 */
export async function generateReportDocxBlob(input: ReportInput): Promise<Blob> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } =
    docx;

  const { questions, transcripts, codings, memos, canvasName: name, date } = input;
  const { questionMap, transcriptMap, coverage } = derive(input);
  const children: InstanceType<typeof Paragraph | typeof Table>[] = [];

  /**
   * WordprocessingML has no newline inside a run: a Paragraph built from a
   * plain `text` string collapses a multi-paragraph memo into one run-on
   * block. Each line therefore becomes its own run, with an explicit <w:br/>
   * in front of every line after the first.
   */
  type RunProps = Omit<ConstructorParameters<typeof TextRun>[0] & object, 'text' | 'break'>;
  const textRuns = (text: string, props: RunProps = {}) =>
    String(text)
      .split('\n')
      .map((line, i) => new TextRun({ ...props, text: line, ...(i > 0 ? { break: 1 } : {}) }));

  const heading = (text: string) =>
    children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 } }));
  const sub = (text: string) =>
    children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } }));
  const cell = (text: string, bold = false) =>
    new TableCell({
      width: { size: 25, type: WidthType.PERCENTAGE },
      children: [new Paragraph({ children: textRuns(text, { bold, size: 20 }) })],
    });
  const table = (header: string[], rows: string[][]) =>
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'EEEEEE' },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
          new TableRow({ children: header.map((h) => cell(h, true)) }),
          ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
        ],
      }),
    );

  children.push(new Paragraph({ text: name, heading: HeadingLevel.TITLE }));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `Generated on ${date} by QualCanvas`, italics: true, color: '6B7280' })],
      spacing: { after: 240 },
    }),
  );

  if (input.includeSummary) {
    const overallPct = overallCoverage(coverage);
    heading('Project Summary');
    table(
      ['Sources', 'Codes', 'Excerpts', 'Coverage'],
      [[String(transcripts.length), String(questions.length), String(codings.length), `${overallPct}%`]],
    );
  }

  if (input.includeCoverage && transcripts.length > 0) {
    heading('Source Coverage');
    table(
      ['Source', 'Words', 'Coverage', 'Codes applied'],
      transcripts.map((t: CanvasTranscript) => {
        const wordCount = wordCountOf(t.content);
        const codeCount = new Set(
          codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id).map((c) => c.questionId),
        ).size;
        return [t.title, wordCount.toLocaleString(), `${coverage.get(t.id)?.pct ?? 0}%`, String(codeCount)];
      }),
    );
  }

  if (input.includeCodebook) {
    heading('Codebook');
    table(
      ['Code', 'Parent theme', 'Frequency'],
      questions.map((q: CanvasQuestion) => {
        const count = codings.filter((c: CanvasTextCoding) => c.questionId === q.id).length;
        const parentQ = q.parentQuestionId ? questionMap.get(q.parentQuestionId) : null;
        return [q.text, parentQ?.text || '—', String(count)];
      }),
    );
  }

  const excerpt = (quote: string, source: string, annotation?: string | null) => {
    children.push(
      new Paragraph({
        children: textRuns(`“${quote}”`),
        indent: { left: 360 },
        spacing: { before: 120, after: 40 },
      }),
    );
    children.push(
      new Paragraph({
        children: textRuns(`— ${source}`, { italics: true, color: '6B7280', size: 18 }),
        indent: { left: 360 },
        spacing: { after: annotation ? 40 : 120 },
      }),
    );
    if (annotation) {
      children.push(
        new Paragraph({
          children: textRuns(`Note: ${annotation}`, { italics: true, color: '92400E', size: 18 }),
          indent: { left: 720 },
          spacing: { after: 120 },
        }),
      );
    }
  };

  if (input.includeExcerpts) {
    heading('Coded Excerpts');
    if (input.groupBy === 'code') {
      questions.forEach((q: CanvasQuestion) => {
        const qCodings = codings.filter((c: CanvasTextCoding) => c.questionId === q.id);
        if (qCodings.length === 0) return;
        sub(`${q.text} (${qCodings.length})`);
        qCodings.forEach((c: CanvasTextCoding) =>
          excerpt(c.codedText, transcriptMap.get(c.transcriptId)?.title || 'Unknown', c.annotation),
        );
      });
    } else if (input.groupBy === 'source') {
      transcripts.forEach((t: CanvasTranscript) => {
        const tCodings = codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id);
        if (tCodings.length === 0) return;
        sub(`${t.title} (${tCodings.length} excerpt${tCodings.length !== 1 ? 's' : ''})`);
        tCodings.forEach((c: CanvasTextCoding) =>
          excerpt(c.codedText, `[${questionMap.get(c.questionId)?.text || 'Unknown'}]`, c.annotation),
        );
      });
    } else {
      caseGroupsOf(input).forEach((group) => {
        if (group.transcripts.length === 0) return;
        const tIds = new Set(group.transcripts.map((t) => t.id));
        const caseCodings = codings.filter((c: CanvasTextCoding) => tIds.has(c.transcriptId));
        if (caseCodings.length === 0) return;
        sub(
          `${group.case?.name || 'Uncategorized'} (${caseCodings.length} excerpt${caseCodings.length !== 1 ? 's' : ''})`,
        );
        caseCodings.forEach((c: CanvasTextCoding) =>
          excerpt(
            c.codedText,
            `${transcriptMap.get(c.transcriptId)?.title || 'Unknown'} · [${questionMap.get(c.questionId)?.text || 'Unknown'}]`,
            c.annotation,
          ),
        );
      });
    }
  }

  if (input.includeMemos && memos.length > 0) {
    heading('Research Memos');
    memos.forEach((m: CanvasMemo) => {
      sub(m.title || 'Memo');
      children.push(new Paragraph({ children: textRuns(m.content), spacing: { after: 160 } }));
    });
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}

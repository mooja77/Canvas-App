/**
 * QDPX Export — produces a REFI-QDA compliant ZIP containing project XML.
 * Uses template literal strings for XML building (no external XML library).
 */

import archiver from 'archiver';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildQdpxXml, type ExportCode } from './qdpxParse.js';

interface QuestionRow {
  id: string;
  text: string;
  color: string | null;
  parentQuestionId: string | null;
}

/** Rebuild the code hierarchy from flat rows so it can be written out nested. */
function buildCodeTree(rows: QuestionRow[]): ExportCode[] {
  const nodes = new Map<string, ExportCode>(
    rows.map((r) => [r.id, { id: r.id, text: r.text, color: r.color, children: [] }]),
  );

  const roots: ExportCode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;

    const parent = row.parentQuestionId ? nodes.get(row.parentQuestionId) : undefined;
    // A code whose parent was deleted is treated as a root rather than dropped.
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export async function exportQdpx(canvasId: string): Promise<Buffer> {
  const canvas = await prisma.codingCanvas.findUnique({
    where: { id: canvasId },
    include: {
      transcripts: { where: { deletedAt: null } },
      questions: true,
      codings: true,
    },
  });

  if (!canvas) {
    throw new AppError('Canvas not found', 404);
  }

  const projectXml = buildQdpxXml({
    name: canvas.name,
    createdAt: canvas.createdAt,
    codes: buildCodeTree(canvas.questions),
    sources: canvas.transcripts.map((t) => ({ id: t.id, title: t.title, content: t.content })),
    codings: canvas.codings.map((c) => ({
      id: c.id,
      transcriptId: c.transcriptId,
      questionId: c.questionId,
      startOffset: c.startOffset,
      endOffset: c.endOffset,
    })),
  });

  // Create ZIP
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', (err: Error) => reject(err));

    archive.append(projectXml, { name: 'project.qde' });
    archive.finalize();
  });
}

/**
 * QDPX Export — produces a REFI-QDA compliant ZIP containing project XML.
 * Uses template literal strings for XML building (no external XML library).
 */

import archiver from 'archiver';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { buildQdpxProject, type ExportCode, type ExportUser } from './qdpxParse.js';

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

/** Plural-aware "3 memos" / "1 memo". */
function count(n: number, singular: string, plural = `${singular}s`): string | null {
  return n > 0 ? `${n} ${n === 1 ? singular : plural}` : null;
}

export interface QdpxExportResult {
  buffer: Buffer;
  /** Canvas content the QDA-XML mapping cannot carry, phrased for a human. */
  notes: string[];
}

export async function exportQdpx(canvasId: string): Promise<QdpxExportResult> {
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

  // Resolve the researchers referenced by the codings so <Users> can name them.
  // Attribution is the whole point of the intercoder feature; an archive that
  // drops it cannot be handed on.
  const coderIds = [...new Set(canvas.codings.map((c) => c.coderUserId).filter((id): id is string => !!id))];
  const coders =
    coderIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: coderIds } }, select: { id: true, name: true, email: true } })
      : [];
  const users: ExportUser[] = coders.map((u) => ({ id: u.id, name: u.name || u.email }));
  // A coding may point at a user row that no longer exists (deleted account).
  const namedCoderIds = new Set(users.map((u) => u.id));

  // Everything QualCanvas models that QDA-XML v1.0, as QualCanvas writes it,
  // does not carry. Counted rather than guessed so the disclosure is true for
  // this canvas specifically.
  const [memos, cases, relations, computedNodes] = await Promise.all([
    prisma.canvasMemo.count({ where: { canvasId } }),
    prisma.canvasCase.count({ where: { canvasId } }),
    prisma.canvasRelation.count({ where: { canvasId } }),
    prisma.canvasComputedNode.count({ where: { canvasId } }),
  ]);
  const codingNotes = canvas.codings.filter((c) => c.note && c.note.trim() !== '').length;
  const annotations = canvas.codings.filter((c) => c.annotation && c.annotation.trim() !== '').length;
  const aiCodings = canvas.codings.filter((c) => c.source && c.source !== 'human').length;
  const unnamedCoders = canvas.codings.filter((c) => c.coderUserId && !namedCoderIds.has(c.coderUserId)).length;

  const omitted = [
    count(memos, 'memo'),
    count(cases, 'case'),
    count(relations, 'relation'),
    count(computedNodes, 'computed node'),
    count(codingNotes, 'coding note'),
    count(annotations, 'coding annotation'),
    count(aiCodings, 'AI-provenance flag'),
    count(unnamedCoders, 'coding whose coder account no longer exists', 'codings whose coder accounts no longer exist'),
  ].filter((s): s is string => s !== null);

  const { xml: projectXml, notes } = buildQdpxProject({
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
      coderUserId: c.coderUserId && namedCoderIds.has(c.coderUserId) ? c.coderUserId : null,
    })),
    users,
    omitted,
  });

  // Create ZIP
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', (err: Error) => reject(err));

    archive.append(projectXml, { name: 'project.qde' });
    archive.finalize();
  });

  return { buffer, notes };
}

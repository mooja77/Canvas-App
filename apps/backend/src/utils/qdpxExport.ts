/**
 * QDPX Export — produces a REFI-QDA compliant ZIP containing project XML.
 * Uses template literal strings for XML building (no external XML library).
 */

import archiver from 'archiver';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(d: Date): string {
  return d.toISOString();
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

  // Build codebook XML (questions = codes)
  const codesXml = canvas.questions
    .map(
      (q: any) =>
        `    <Code guid="${escapeXml(q.id)}" name="${escapeXml(q.text)}" color="${escapeXml(q.color)}" isCodable="true" />`
    )
    .join('\n');

  // Build sources XML (transcripts = text sources)
  const sourcesXml = canvas.transcripts
    .map(
      (t: any) =>
        `    <TextSource guid="${escapeXml(t.id)}" name="${escapeXml(t.title)}" plainTextContent="${escapeXml(t.content)}" creationDateTime="${formatDate(t.createdAt)}" />`
    )
    .join('\n');

  // Build codings (selections)
  const codingsXml = canvas.codings
    .map(
      (c: any) =>
        `    <Coding guid="${escapeXml(c.id)}" codeGUID="${escapeXml(c.questionId)}">
      <TextSelection guid="${escapeXml(c.id)}-sel" sourceGUID="${escapeXml(c.transcriptId)}" startPosition="${c.startOffset}" endPosition="${c.endOffset}" />
    </Coding>`
    )
    .join('\n');

  const projectXml = `<?xml version="1.0" encoding="utf-8"?>
<Project name="${escapeXml(canvas.name)}" origin="CanvasApp" creatingUserGUID="system" creationDateTime="${formatDate(canvas.createdAt)}" xmlns="urn:QDA-XML:project:1.0">
  <CodeBook>
${codesXml}
  </CodeBook>
  <Sources>
${sourcesXml}
  </Sources>
  <Codings>
${codingsXml}
  </Codings>
</Project>
`;

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

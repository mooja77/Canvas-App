/**
 * QDPX Import — parses a REFI-QDA ZIP file and creates Prisma records.
 * Uses yauzl for ZIP extraction and fast-xml-parser for XML parsing.
 */

import yauzl from 'yauzl';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Prisma } from '@prisma/client';
import { parseQdpxProject, flattenCodesForInsert, describeLosses } from './qdpxParse.js';

// Cap decompressed size to limit zip-bomb impact. 100MB is well above any
// legitimate QDPX project XML while stopping 1000:1 compression ratio attacks
// that would otherwise exhaust memory on a legitimate-looking small upload.
const MAX_ENTRY_BYTES = 100 * 1024 * 1024;
// Also cap the total decompressed bytes across all entries we inspect.
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const MAX_CODES = 5_000;
const MAX_SOURCES = 1_000;
const MAX_CODINGS = 100_000;
const MAX_SOURCE_WORDS = 50_000;

/** Text-bearing entries we will read alongside the project XML. */
const TEXT_ENTRY_RE = /\.(txt|qde|xml)$/i;

interface QdpxArchive {
  projectXml: string;
  /** Lower-cased basename to contents, for resolving internal:// references. */
  textFiles: Map<string, string>;
}

/**
 * Read a .qdpx archive: the project XML plus any plain-text source files it
 * may reference. Size caps are enforced on every entry — a QDPX is a ZIP from
 * an untrusted upload, and the classic attack is a small archive declaring
 * enormous decompressed entries.
 */
function readQdpxArchive(zipBuffer: Buffer): Promise<QdpxArchive> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err || new Error('Failed to open ZIP'));

      let projectXml: string | null = null;
      const textFiles = new Map<string, string>();
      let totalBytes = 0;

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        // Short-circuit on the declared uncompressed size from the central
        // directory, so an oversized entry is rejected without decompressing.
        const declaredSize = Number((entry as unknown as { uncompressedSize?: bigint | number }).uncompressedSize ?? 0);
        if (declaredSize > MAX_ENTRY_BYTES) {
          return reject(new AppError('QDPX archive entry exceeds size limit', 400));
        }
        if (totalBytes + declaredSize > MAX_TOTAL_BYTES) {
          return reject(new AppError('QDPX archive exceeds total size limit', 400));
        }

        const isProject = entry.fileName.endsWith('.qde') || entry.fileName.endsWith('.xml');
        if (!TEXT_ENTRY_RE.test(entry.fileName)) {
          // Binary sources (docx/pdf/audio/video) are not imported; count their
          // size toward the total and move on without decompressing.
          totalBytes += declaredSize;
          return zipfile.readEntry();
        }

        zipfile.openReadStream(entry, (err2, readStream) => {
          if (err2 || !readStream) return reject(err2 || new Error('Failed to read entry'));
          const chunks: Buffer[] = [];
          let entryBytes = 0;

          readStream.on('data', (chunk: Buffer) => {
            entryBytes += chunk.length;
            // Defense in depth: even if declaredSize was forged in the header,
            // stop once actual decompressed bytes exceed the limit.
            if (entryBytes > MAX_ENTRY_BYTES) {
              readStream.destroy();
              reject(new AppError('QDPX archive entry exceeds size limit', 400));
              return;
            }
            chunks.push(chunk);
          });

          readStream.on('end', () => {
            totalBytes += entryBytes;
            const content = Buffer.concat(chunks).toString('utf-8');
            if (isProject && projectXml === null) projectXml = content;
            else if (!isProject) textFiles.set(basename(entry.fileName), content);
            zipfile.readEntry();
          });

          readStream.on('error', reject);
        });
      });

      zipfile.on('end', () => {
        if (projectXml === null) return reject(new AppError('No project XML found in QDPX file', 400));
        resolve({ projectXml, textFiles });
      });
      zipfile.on('error', reject);
    });
  });
}

function basename(p: string): string {
  return p.split(/[\\/]/).pop()?.toLowerCase() ?? p.toLowerCase();
}

/**
 * Resolve a source's text. Conformant files may inline it in
 * <PlainTextContent>; NVivo and others instead point at a separate archive
 * entry with plainTextPath="internal://<name>". Match on basename, since
 * implementations disagree about the folder ("sources/", "Sources/", none).
 */
function resolveSourceText(inline: string, plainTextPath: string | undefined, textFiles: Map<string, string>): string {
  if (inline) return inline;
  if (!plainTextPath) return '';
  return textFiles.get(basename(plainTextPath.replace(/^internal:\/\//i, ''))) ?? '';
}

export interface QdpxImportResult {
  codes: number;
  sources: number;
  codings: number;
  /** Constructs present in the file that QualCanvas cannot represent. */
  unsupported: string[];
  /** Codings whose code, source or text range could not be resolved. */
  skippedCodings: number;
}

export async function importQdpx(canvasId: string, zipBuffer: Buffer): Promise<QdpxImportResult> {
  const canvas = await prisma.codingCanvas.findUnique({ where: { id: canvasId } });
  if (!canvas) throw new AppError('Canvas not found', 404);

  const { projectXml, textFiles } = await readQdpxArchive(zipBuffer);

  let project;
  try {
    project = parseQdpxProject(projectXml);
  } catch (err) {
    throw new AppError(err instanceof Error ? err.message : 'Invalid QDPX project file', 400);
  }

  // Sources may carry their text inline or in a separate archive entry
  // (plainTextPath). Resolve before validating sizes so the caps see real text.
  const sourceText = new Map<string, string>(
    project.sources.map((s) => [s.guid, resolveSourceText(s.plainText, s.plainTextPath, textFiles)]),
  );

  const flatCodes = flattenCodesForInsert(project.codes);
  const selectionCount = project.sources.reduce(
    (total, s) => total + s.selections.reduce((n, sel) => n + sel.codeGuids.length, 0),
    0,
  );

  if (flatCodes.length > MAX_CODES || project.sources.length > MAX_SOURCES || selectionCount > MAX_CODINGS) {
    throw new AppError(
      `QDPX project is too large (maximum ${MAX_CODES} codes, ${MAX_SOURCES} sources and ${MAX_CODINGS} codings)`,
      400,
    );
  }

  for (const source of project.sources) {
    const content = sourceText.get(source.guid) ?? '';
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    if (words > MAX_SOURCE_WORDS) {
      throw new AppError(`QDPX source "${source.name || 'Untitled'}" exceeds 50,000 words`, 400);
    }
  }

  // One transaction: a QDPX import is all-or-nothing. A partial import leaves a
  // canvas with codes but no codings and no way to tell what is missing.
  return prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const codeGuidMap = new Map<string, string>();
      const sourceGuidMap = new Map<string, string>();

      // Parents precede children, so each parentGuid already has a row.
      for (const code of flatCodes) {
        if (!code.guid || codeGuidMap.has(code.guid)) {
          throw new AppError('QDPX contains a missing or duplicate code GUID', 400);
        }
        const parentQuestionId = code.parentGuid ? (codeGuidMap.get(code.parentGuid) ?? null) : null;
        const question = await tx.canvasQuestion.create({
          data: {
            canvasId,
            text: (code.name || 'Imported Code').slice(0, 200),
            color: code.color || '#3B82F6',
            parentQuestionId,
          },
        });
        codeGuidMap.set(code.guid, question.id);
      }

      for (const source of project.sources) {
        if (!source.guid || sourceGuidMap.has(source.guid)) {
          throw new AppError('QDPX contains a missing or duplicate source GUID', 400);
        }
        const transcript = await tx.canvasTranscript.create({
          data: {
            canvasId,
            title: (source.name || 'Imported Source').slice(0, 200),
            content: sourceText.get(source.guid) ?? '',
            sourceType: 'qdpx-import',
          },
        });
        sourceGuidMap.set(source.guid, transcript.id);
      }

      let codingCount = 0;
      let skippedCodings = 0;

      for (const source of project.sources) {
        const transcriptId = sourceGuidMap.get(source.guid);
        if (!transcriptId) continue;
        const text = sourceText.get(source.guid) ?? '';

        for (const selection of source.selections) {
          const { startPosition, endPosition } = selection;
          if (endPosition <= startPosition) {
            skippedCodings += selection.codeGuids.length;
            continue;
          }

          // Offsets index the resolved text. If the text could not be resolved
          // (missing archive entry) or the range falls outside it, skip: a
          // coding with empty codedText is worse than an honest skip.
          //
          // `slice` clamps silently, so a selection running past the end of the
          // source used to be accepted with its ORIGINAL endPosition stored.
          // That produced codings whose endOffset exceeded the transcript
          // length, which the coverage statistic then divided by the real
          // length - one imported archive reported 166,616.7% coverage. Reject
          // the range rather than persist an offset the text cannot support.
          if (startPosition < 0 || endPosition > text.length) {
            skippedCodings += selection.codeGuids.length;
            continue;
          }
          const codedText = text.slice(startPosition, endPosition);
          if (codedText === '') {
            skippedCodings += selection.codeGuids.length;
            continue;
          }

          for (const codeGuid of selection.codeGuids) {
            const questionId = codeGuidMap.get(codeGuid);
            if (!questionId) {
              skippedCodings++;
              continue;
            }

            await tx.canvasTextCoding.create({
              data: {
                canvasId,
                transcriptId,
                questionId,
                startOffset: startPosition,
                endOffset: endPosition,
                codedText,
              },
            });
            codingCount++;
          }
        }
      }

      return {
        codes: project.totalCodes,
        sources: project.sources.length,
        codings: codingCount,
        unsupported: describeLosses(project.unsupported),
        skippedCodings,
      };
    },
    { timeout: 30_000 },
  );
}

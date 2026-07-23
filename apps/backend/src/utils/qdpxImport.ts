/**
 * QDPX Import — parses a REFI-QDA ZIP file and creates Prisma records.
 * Uses yauzl for ZIP extraction and fast-xml-parser for XML parsing.
 */

import yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Prisma } from '@prisma/client';

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

interface QdpxCode {
  '@_guid': string;
  '@_name': string;
  '@_color'?: string;
}

interface QdpxTextSource {
  '@_guid': string;
  '@_name': string;
  '@_plainTextContent'?: string;
}

interface QdpxTextSelection {
  '@_sourceGUID': string;
  '@_startPosition': string;
  '@_endPosition': string;
}

interface QdpxCoding {
  '@_guid': string;
  '@_codeGUID': string;
  TextSelection?: QdpxTextSelection | QdpxTextSelection[];
}

function extractZipEntry(zipBuffer: Buffer, entryName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err || new Error('Failed to open ZIP'));

      let found = false;
      let totalBytes = 0;
      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        // Short-circuit based on the declared uncompressed size. yauzl exposes
        // this in the central directory header so we can reject without ever
        // decompressing the entry's stream.
        const declaredSize = Number((entry as unknown as { uncompressedSize?: bigint | number }).uncompressedSize ?? 0);
        if (declaredSize > MAX_ENTRY_BYTES) {
          return reject(new AppError('QDPX archive entry exceeds size limit', 400));
        }
        if (totalBytes + declaredSize > MAX_TOTAL_BYTES) {
          return reject(new AppError('QDPX archive exceeds total size limit', 400));
        }

        if (entry.fileName.endsWith('.qde') || entry.fileName.endsWith('.xml') || entry.fileName === entryName) {
          found = true;
          zipfile.openReadStream(entry, (err2, readStream) => {
            if (err2 || !readStream) return reject(err2 || new Error('Failed to read entry'));
            const chunks: Buffer[] = [];
            let entryBytes = 0;
            readStream.on('data', (chunk: Buffer) => {
              entryBytes += chunk.length;
              // Defense in depth: even if declaredSize was forged, stop reading
              // once actual bytes exceed the limit.
              if (entryBytes > MAX_ENTRY_BYTES) {
                readStream.destroy();
                reject(new AppError('QDPX archive entry exceeds size limit', 400));
                return;
              }
              chunks.push(chunk);
            });
            readStream.on('end', () => {
              totalBytes += entryBytes;
              resolve(Buffer.concat(chunks).toString('utf-8'));
            });
            readStream.on('error', reject);
          });
        } else {
          totalBytes += declaredSize;
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        if (!found) reject(new AppError('No project XML found in QDPX file', 400));
      });
      zipfile.on('error', reject);
    });
  });
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export async function importQdpx(
  canvasId: string,
  zipBuffer: Buffer,
): Promise<{ codes: number; sources: number; codings: number }> {
  // Verify canvas exists
  const canvas = await prisma.codingCanvas.findUnique({ where: { id: canvasId } });
  if (!canvas) throw new AppError('Canvas not found', 404);

  // Extract and parse XML
  const xmlContent = await extractZipEntry(zipBuffer, 'project.qde');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['Code', 'TextSource', 'Coding', 'TextSelection'].includes(name),
    processEntities: false, // Prevent XXE attacks
    htmlEntities: false,
  });

  const parsed = parser.parse(xmlContent);
  const project = parsed.Project || parsed['Project'];
  if (!project) throw new AppError('Invalid QDPX: no Project element found', 400);

  // Extract codes
  const codes = toArray<QdpxCode>(project.CodeBook?.Code);
  // Extract sources
  const sources = toArray<QdpxTextSource>(project.Sources?.TextSource);
  // Extract codings
  const codings = toArray<QdpxCoding>(project.Codings?.Coding);
  const selectionCount = codings.reduce((total, coding) => total + toArray(coding.TextSelection).length, 0);
  if (codes.length > MAX_CODES || sources.length > MAX_SOURCES || selectionCount > MAX_CODINGS) {
    throw new AppError(
      `QDPX project is too large (maximum ${MAX_CODES} codes, ${MAX_SOURCES} sources and ${MAX_CODINGS} codings)`,
      400,
    );
  }
  for (const source of sources) {
    const content = source['@_plainTextContent'] || '';
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    if (words > MAX_SOURCE_WORDS) {
      throw new AppError(`QDPX source "${source['@_name'] || 'Untitled'}" exceeds 50,000 words`, 400);
    }
  }

  return prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const codeGuidMap = new Map<string, string>();
      const sourceGuidMap = new Map<string, string>();
      const sourceContentMap = new Map<string, string>();

      for (const code of codes) {
        const guid = code['@_guid'];
        if (!guid || codeGuidMap.has(guid)) throw new AppError('QDPX contains a missing or duplicate code GUID', 400);
        const question = await tx.canvasQuestion.create({
          data: {
            canvasId,
            text: (code['@_name'] || 'Imported Code').slice(0, 200),
            color: code['@_color'] || '#3B82F6',
          },
        });
        codeGuidMap.set(guid, question.id);
      }

      for (const source of sources) {
        const guid = source['@_guid'];
        if (!guid || sourceGuidMap.has(guid)) {
          throw new AppError('QDPX contains a missing or duplicate source GUID', 400);
        }
        const content = source['@_plainTextContent'] || '';
        const transcript = await tx.canvasTranscript.create({
          data: {
            canvasId,
            title: (source['@_name'] || 'Imported Source').slice(0, 200),
            content,
            sourceType: 'qdpx-import',
          },
        });
        sourceGuidMap.set(guid, transcript.id);
        sourceContentMap.set(guid, content);
      }

      let codingCount = 0;
      for (const coding of codings) {
        const questionId = codeGuidMap.get(coding['@_codeGUID']);
        if (!questionId) continue;

        for (const selection of toArray<QdpxTextSelection>(coding.TextSelection)) {
          const sourceGuid = selection['@_sourceGUID'];
          const transcriptId = sourceGuidMap.get(sourceGuid);
          const sourceContent = sourceContentMap.get(sourceGuid);
          if (!transcriptId || sourceContent === undefined) continue;

          const startOffset = Number.parseInt(selection['@_startPosition'], 10);
          const endOffset = Number.parseInt(selection['@_endPosition'], 10);
          if (
            !Number.isInteger(startOffset) ||
            !Number.isInteger(endOffset) ||
            startOffset < 0 ||
            endOffset <= startOffset ||
            endOffset > sourceContent.length
          ) {
            continue;
          }

          await tx.canvasTextCoding.create({
            data: {
              canvasId,
              transcriptId,
              questionId,
              startOffset,
              endOffset,
              codedText: sourceContent.slice(startOffset, endOffset),
            },
          });
          codingCount++;
        }
      }

      return { codes: codes.length, sources: sources.length, codings: codingCount };
    },
    { maxWait: 10_000, timeout: 120_000 },
  );
}

/**
 * QDPX Import — parses a REFI-QDA ZIP file and creates Prisma records.
 * Uses yauzl for ZIP extraction and fast-xml-parser for XML parsing.
 */

import yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

// Cap decompressed size to limit zip-bomb impact. 100MB is well above any
// legitimate QDPX project XML while stopping 1000:1 compression ratio attacks
// that would otherwise exhaust memory on a legitimate-looking small upload.
const MAX_ENTRY_BYTES = 100 * 1024 * 1024;
// Also cap the total decompressed bytes across all entries we inspect.
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

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

  // Map external GUIDs to internal IDs
  const codeGuidMap = new Map<string, string>();
  const sourceGuidMap = new Map<string, string>();

  // Create questions (codes)
  for (const code of codes) {
    const question = await prisma.canvasQuestion.create({
      data: {
        canvasId,
        text: code['@_name'] || 'Imported Code',
        color: code['@_color'] || '#3B82F6',
      },
    });
    codeGuidMap.set(code['@_guid'], question.id);
  }

  // Create transcripts (sources)
  for (const source of sources) {
    const transcript = await prisma.canvasTranscript.create({
      data: {
        canvasId,
        title: source['@_name'] || 'Imported Source',
        content: source['@_plainTextContent'] || '',
        sourceType: 'qdpx-import',
      },
    });
    sourceGuidMap.set(source['@_guid'], transcript.id);
  }

  // Create codings
  let codingCount = 0;
  for (const coding of codings) {
    const questionId = codeGuidMap.get(coding['@_codeGUID']);
    if (!questionId) continue;

    const selections = toArray<QdpxTextSelection>(coding.TextSelection);
    for (const sel of selections) {
      const transcriptId = sourceGuidMap.get(sel['@_sourceGUID']);
      if (!transcriptId) continue;

      const startOffset = parseInt(sel['@_startPosition'], 10) || 0;
      const endOffset = parseInt(sel['@_endPosition'], 10) || 0;
      if (endOffset <= startOffset) continue;

      // Get the coded text from the transcript
      const transcript = await prisma.canvasTranscript.findUnique({
        where: { id: transcriptId },
        select: { content: true },
      });
      const codedText = transcript?.content.slice(startOffset, endOffset) || '';

      await prisma.canvasTextCoding.create({
        data: {
          canvasId,
          transcriptId,
          questionId,
          startOffset,
          endOffset,
          codedText,
        },
      });
      codingCount++;
    }
  }

  return { codes: codes.length, sources: sources.length, codings: codingCount };
}

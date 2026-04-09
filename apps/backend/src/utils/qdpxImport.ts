/**
 * QDPX Import — parses a REFI-QDA ZIP file and creates Prisma records.
 * Uses yauzl for ZIP extraction and fast-xml-parser for XML parsing.
 */

import yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

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
      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        if (entry.fileName.endsWith('.qde') || entry.fileName.endsWith('.xml') || entry.fileName === entryName) {
          found = true;
          zipfile.openReadStream(entry, (err2, readStream) => {
            if (err2 || !readStream) return reject(err2 || new Error('Failed to read entry'));
            const chunks: Buffer[] = [];
            readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
            readStream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
            readStream.on('error', reject);
          });
        } else {
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

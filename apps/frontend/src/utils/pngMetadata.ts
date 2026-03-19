/**
 * PNG metadata utilities for embedding/extracting canvas data in PNG files.
 * Uses the PNG tEXt chunk format to store canvas JSON data.
 */

const CANVAS_KEY = 'canvas-app-data';

// PNG signature: 8 bytes
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createTExtChunk(key: string, value: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key);
  const valueBytes = new TextEncoder().encode(value);
  // tEXt chunk: key + null separator + value
  const dataLength = keyBytes.length + 1 + valueBytes.length;
  const chunk = new Uint8Array(12 + dataLength); // 4 length + 4 type + data + 4 CRC
  const view = new DataView(chunk.buffer);

  // Length
  view.setUint32(0, dataLength, false);

  // Type: tEXt
  chunk[4] = 0x74; // t
  chunk[5] = 0x45; // E
  chunk[6] = 0x58; // X
  chunk[7] = 0x74; // t

  // Data: key + null + value
  chunk.set(keyBytes, 8);
  chunk[8 + keyBytes.length] = 0; // null separator
  chunk.set(valueBytes, 9 + keyBytes.length);

  // CRC (over type + data)
  const crcData = chunk.slice(4, 8 + dataLength);
  const crcValue = crc32(crcData);
  view.setUint32(8 + dataLength, crcValue, false);

  return chunk;
}

/**
 * Embed canvas JSON data into a PNG data URL.
 * Inserts a tEXt chunk with key "canvas-app-data" before the IEND chunk.
 */
export async function embedCanvasInPNG(dataUrl: string, canvasJson: unknown): Promise<string> {
  // Convert data URL to ArrayBuffer
  const response = await fetch(dataUrl);
  const buffer = await response.arrayBuffer();
  const original = new Uint8Array(buffer);

  // Validate PNG signature
  for (let i = 0; i < 8; i++) {
    if (original[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Not a valid PNG file');
    }
  }

  // Find IEND chunk position
  let iendPos = -1;
  let pos = 8; // after signature
  while (pos < original.length) {
    const chunkLength = new DataView(original.buffer, pos, 4).getUint32(0, false);
    const chunkType = String.fromCharCode(original[pos + 4], original[pos + 5], original[pos + 6], original[pos + 7]);
    if (chunkType === 'IEND') {
      iendPos = pos;
      break;
    }
    pos += 12 + chunkLength; // length(4) + type(4) + data + crc(4)
  }

  if (iendPos < 0) {
    throw new Error('IEND chunk not found');
  }

  // Create tEXt chunk with canvas data
  const jsonStr = JSON.stringify(canvasJson);
  const textChunk = createTExtChunk(CANVAS_KEY, jsonStr);

  // Rebuild PNG: signature + existing chunks (up to IEND) + tEXt + IEND
  const beforeIEND = original.slice(0, iendPos);
  const iendChunk = original.slice(iendPos);
  const result = new Uint8Array(beforeIEND.length + textChunk.length + iendChunk.length);
  result.set(beforeIEND, 0);
  result.set(textChunk, beforeIEND.length);
  result.set(iendChunk, beforeIEND.length + textChunk.length);

  // Convert back to data URL
  const blob = new Blob([result], { type: 'image/png' });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Extract canvas JSON data from a PNG file.
 * Scans for a tEXt chunk with key "canvas-app-data".
 * Returns null if not found.
 */
export async function extractCanvasFromPNG(file: File): Promise<unknown | null> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  // Validate PNG signature
  for (let i = 0; i < 8; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) {
      return null; // Not a PNG
    }
  }

  let pos = 8;
  while (pos < data.length) {
    const chunkLength = new DataView(data.buffer, pos, 4).getUint32(0, false);
    const chunkType = String.fromCharCode(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]);

    if (chunkType === 'tEXt') {
      const chunkData = data.slice(pos + 8, pos + 8 + chunkLength);
      // Find null separator
      const nullIdx = chunkData.indexOf(0);
      if (nullIdx >= 0) {
        const key = new TextDecoder().decode(chunkData.slice(0, nullIdx));
        if (key === CANVAS_KEY) {
          const value = new TextDecoder().decode(chunkData.slice(nullIdx + 1));
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        }
      }
    }

    if (chunkType === 'IEND') break;
    pos += 12 + chunkLength;
  }

  return null;
}

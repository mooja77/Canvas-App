/**
 * Local Filesystem Storage Provider (development fallback)
 *
 * Stores files in ./uploads/ directory relative to the backend root.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { StorageProvider, UploadOptions, PresignedUrlOptions } from './storage.js';
import { setStorageProvider } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

const localProvider: StorageProvider = {
  name: 'local',

  async upload(options: UploadOptions) {
    const filePath = path.join(UPLOAD_DIR, options.key);
    await ensureDir(path.dirname(filePath));

    if (Buffer.isBuffer(options.body)) {
      await fs.writeFile(filePath, options.body);
      return { key: options.key, size: options.body.length };
    }

    // Handle stream
    const chunks: Buffer[] = [];
    const stream = options.body as NodeJS.ReadableStream;
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    await fs.writeFile(filePath, buffer);
    return { key: options.key, size: buffer.length };
  },

  async getUploadUrl(options: PresignedUrlOptions) {
    // Local storage doesn't support pre-signed URLs.
    // Return a local upload endpoint path instead.
    return {
      url: `/api/upload/local/${encodeURIComponent(options.key)}`,
      key: options.key,
    };
  },

  async getDownloadUrl(key: string) {
    // Return a local download endpoint path
    return `/api/upload/local/${encodeURIComponent(key)}`;
  },

  async delete(key: string) {
    const filePath = path.join(UPLOAD_DIR, key);
    try {
      await fs.unlink(filePath);
    } catch {
      // File may not exist, ignore
    }
  },

  async exists(key: string) {
    const filePath = path.join(UPLOAD_DIR, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
};

// Auto-register as fallback if S3 is not configured
if (!process.env.S3_BUCKET) {
  setStorageProvider(localProvider);
}

export default localProvider;

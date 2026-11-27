/**
 * Local Filesystem Storage Provider (development fallback)
 *
 * Stores files in ./uploads/ directory relative to the backend root.
 */

import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import type { StorageProvider, UploadOptions, PresignedUrlOptions } from './storage.js';
import { setStorageProvider } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function resolveStoragePath(key: string): string {
  if (!key || path.isAbsolute(key) || key.includes('\0')) {
    throw new Error('Invalid storage key');
  }
  const resolved = path.resolve(UPLOAD_DIR, key);
  if (!resolved.startsWith(`${UPLOAD_DIR}${path.sep}`)) {
    throw new Error('Storage key escapes upload directory');
  }
  return resolved;
}

const localProvider: StorageProvider = {
  name: 'local',

  async upload(options: UploadOptions) {
    const filePath = resolveStoragePath(options.key);
    await ensureDir(path.dirname(filePath));

    if (Buffer.isBuffer(options.body)) {
      await fs.writeFile(filePath, options.body);
      return { key: options.key, size: options.body.length };
    }

    // Stream directly to disk so large uploads stay constant-memory.
    const stream = options.body as NodeJS.ReadableStream;
    await pipeline(stream, createWriteStream(filePath));
    const stat = await fs.stat(filePath);
    return { key: options.key, size: stat.size };
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
    const filePath = resolveStoragePath(key);
    try {
      await fs.unlink(filePath);
    } catch {
      // File may not exist, ignore
    }
  },

  async exists(key: string) {
    const filePath = resolveStoragePath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },

  async head(key: string) {
    const stat = await fs.stat(resolveStoragePath(key));
    return { size: stat.size };
  },

  async openReadStream(key: string) {
    return createReadStream(resolveStoragePath(key));
  },
};

// Auto-register as fallback if S3 is not configured
if (!process.env.S3_BUCKET) {
  setStorageProvider(localProvider);
}

export default localProvider;

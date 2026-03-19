/**
 * Storage Provider Abstraction Layer
 *
 * Pluggable interface for file storage (S3, local disk, etc.)
 */

export interface UploadOptions {
  key: string;
  body: Buffer | NodeJS.ReadableStream;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface PresignedUrlOptions {
  key: string;
  contentType: string;
  expiresIn?: number; // seconds, default 3600
}

export interface StorageProvider {
  readonly name: string;

  /** Upload a file directly */
  upload(options: UploadOptions): Promise<{ key: string; size: number }>;

  /** Generate a pre-signed URL for client-side upload */
  getUploadUrl(options: PresignedUrlOptions): Promise<{ url: string; key: string }>;

  /** Generate a pre-signed URL for reading/downloading */
  getDownloadUrl(key: string, expiresIn?: number): Promise<string>;

  /** Delete a file */
  delete(key: string): Promise<void>;

  /** Check if a file exists */
  exists(key: string): Promise<boolean>;
}

let activeProvider: StorageProvider | null = null;

export function setStorageProvider(provider: StorageProvider): void {
  activeProvider = provider;
}

export function getStorageProvider(): StorageProvider {
  if (!activeProvider) {
    // Auto-detect based on environment
    if (process.env.S3_BUCKET) {
      throw new Error('S3 storage configured but provider not initialized. Import storage-s3.ts first.');
    }
    throw new Error('No storage provider configured. Import storage-s3.ts or storage-local.ts first.');
  }
  return activeProvider;
}

/** Convenience shortcuts */
export const storage = {
  upload: (options: UploadOptions) => getStorageProvider().upload(options),
  getUploadUrl: (options: PresignedUrlOptions) => getStorageProvider().getUploadUrl(options),
  getDownloadUrl: (key: string, expiresIn?: number) => getStorageProvider().getDownloadUrl(key, expiresIn),
  delete: (key: string) => getStorageProvider().delete(key),
  exists: (key: string) => getStorageProvider().exists(key),
};

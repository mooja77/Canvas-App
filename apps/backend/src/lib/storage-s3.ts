/**
 * S3-compatible Storage Provider (works with AWS S3, Cloudflare R2, MinIO)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageProvider, UploadOptions, PresignedUrlOptions } from './storage.js';
import { setStorageProvider } from './storage.js';

const bucket = process.env.S3_BUCKET || '';
const region = process.env.S3_REGION || 'us-east-1';

function createClient(): S3Client {
  const config: Record<string, unknown> = {
    region,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
  };

  // Custom endpoint for R2/MinIO
  if (process.env.S3_ENDPOINT) {
    config.endpoint = process.env.S3_ENDPOINT;
    config.forcePathStyle = true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new S3Client(config as Record<string, any>);
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) client = createClient();
  return client;
}

const s3Provider: StorageProvider = {
  name: 's3',

  async upload(options: UploadOptions) {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: options.key,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Body: options.body as any,
      ContentType: options.contentType,
      Metadata: options.metadata,
    });

    await getClient().send(command);

    // Get size from the body if it's a Buffer
    const size = Buffer.isBuffer(options.body) ? options.body.length : 0;
    return { key: options.key, size };
  },

  async getUploadUrl(options: PresignedUrlOptions) {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: options.key,
      ContentType: options.contentType,
    });

    const url = await getSignedUrl(getClient(), command, {
      expiresIn: options.expiresIn || 3600,
    });

    return { url, key: options.key };
  },

  async getDownloadUrl(key: string, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(getClient(), command, { expiresIn });
  },

  async delete(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await getClient().send(command);
  },

  async exists(key: string) {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      await getClient().send(command);
      return true;
    } catch {
      return false;
    }
  },
};

// Auto-register if S3 is configured
if (bucket) {
  setStorageProvider(s3Provider);
}

export default s3Provider;

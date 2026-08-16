import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { storage } from '../lib/storage.js';
import '../lib/storage-s3.js';
import '../lib/storage-local.js';

/**
 * Delete physical objects before their FileUpload records. If storage is
 * unavailable, fail closed so account/canvas deletion never falsely claims
 * that research media was erased while leaving an orphaned object behind.
 */
export async function deleteStoredUploads(where: Prisma.FileUploadWhereInput): Promise<number> {
  const uploads = await prisma.fileUpload.findMany({
    where,
    select: { id: true, storageKey: true },
  });

  await Promise.all(uploads.map((upload) => storage.delete(upload.storageKey)));
  if (uploads.length) {
    await prisma.fileUpload.deleteMany({ where: { id: { in: uploads.map((upload) => upload.id) } } });
  }
  return uploads.length;
}

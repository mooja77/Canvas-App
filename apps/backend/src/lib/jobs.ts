/**
 * Simple In-Process Job Queue
 *
 * Uses a Map of job IDs with status polling.
 * Suitable for single-instance deployments.
 * For multi-instance, replace with Redis/BullMQ.
 */

import { randomBytes } from 'crypto';

export interface Job<T = unknown> {
  id: string;
  type: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  result?: T;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

type JobHandler<T = unknown> = (
  job: Job<T>,
  updateProgress: (progress: number) => void,
) => Promise<T>;

const jobs = new Map<string, Job>();
const handlers = new Map<string, JobHandler>();

/** Register a handler for a job type */
export function registerJobHandler<T>(type: string, handler: JobHandler<T>): void {
  handlers.set(type, handler as JobHandler);
}

/** Create and enqueue a new job */
export function createJob(type: string, initialData?: Partial<Job>): Job {
  const id = randomBytes(16).toString('hex');
  const job: Job = {
    id,
    type,
    status: 'queued',
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...initialData,
  };

  jobs.set(id, job);

  // Process async
  processJob(id).catch(() => {
    // Error already captured in job
  });

  return job;
}

/** Get a job's current status */
export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/** List jobs by type */
export function listJobs(type?: string): Job[] {
  const all = Array.from(jobs.values());
  return type ? all.filter((j) => j.type === type) : all;
}

/** Clean up completed/failed jobs older than maxAge ms */
export function cleanupJobs(maxAgeMs = 3600000): number {
  const cutoff = Date.now() - maxAgeMs;
  let cleaned = 0;
  for (const [id, job] of jobs) {
    if ((job.status === 'completed' || job.status === 'failed') && job.updatedAt.getTime() < cutoff) {
      jobs.delete(id);
      cleaned++;
    }
  }
  return cleaned;
}

async function processJob(id: string): Promise<void> {
  const job = jobs.get(id);
  if (!job) return;

  const handler = handlers.get(job.type);
  if (!handler) {
    job.status = 'failed';
    job.error = `No handler registered for job type: ${job.type}`;
    job.updatedAt = new Date();
    return;
  }

  job.status = 'processing';
  job.updatedAt = new Date();

  try {
    const result = await handler(job, (progress: number) => {
      job.progress = Math.min(100, Math.max(0, progress));
      job.updatedAt = new Date();
    });

    job.status = 'completed';
    job.progress = 100;
    job.result = result;
    job.updatedAt = new Date();
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : 'Unknown error';
    job.updatedAt = new Date();
  }
}

// Cleanup old jobs every hour
setInterval(() => cleanupJobs(), 3600000);

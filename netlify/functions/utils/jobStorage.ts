import fs from 'fs';
import path from 'path';
import os from 'os';

export type JobStatus = 'uploading' | 'queued' | 'processing' | 'completed' | 'failed';

export interface GenerationJob {
  id: string;
  status: JobStatus;
  stage?: string;
  queuePosition?: number;
  queueMessage?: string;
  progress?: number;
  createdAt: number;
  updatedAt: number;
  result?: {
    images: Array<{ imageUrl: string; index: number; label: string }>;
    primaryImage: string;
    maskedImage?: string;
    mode?: string;
    aspectRatio?: string;
    warnings?: string[];
    garmentStatus?: Record<string, { applied: boolean; model?: string; note: string }>;
  };
  error?: string;
  isQuotaExhausted?: boolean;
  isAuthError?: boolean;
  requiresCredentials?: boolean;
  spaceUsed?: string;
}

export interface StoredJobInput {
  player: { data: string; mimeType?: string };
  garments: Record<string, { data: string; name?: string; slot?: string }>;
  customization?: any;
  mode?: string;
  aspectRatio?: string;
  spaceId?: string;
}

const STORAGE_ROOT = path.join(os.tmpdir(), 'mxm-creator-jobs');

// In-memory quick lookup cache (synced with filesystem)
const memoryCache = new Map<string, GenerationJob>();

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getJobDir(jobId: string): string {
  const safeId = jobId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(STORAGE_ROOT, safeId);
}

/**
 * Prunes jobs older than maxAgeMs (default: 1 hour) to enforce safe retention policy.
 */
export function pruneExpiredJobs(maxAgeMs = 3600 * 1000) {
  try {
    ensureDir(STORAGE_ROOT);
    const now = Date.now();
    const entries = fs.readdirSync(STORAGE_ROOT, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(STORAGE_ROOT, entry.name);
        try {
          const stats = fs.statSync(dirPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            memoryCache.delete(entry.name);
          }
        } catch {
          // ignore stat errors
        }
      }
    }
  } catch (err) {
    console.warn('[JobStorage] Prune expired jobs notice:', err);
  }
}

/**
 * Initializes a new job, persists input images to private temp storage, and returns the job record.
 */
export function createAndStoreJob(jobId: string, input: StoredJobInput): GenerationJob {
  pruneExpiredJobs();

  const jobDir = getJobDir(jobId);
  ensureDir(jobDir);

  const job: GenerationJob = {
    id: jobId,
    status: 'queued',
    stage: 'Queued for background virtual try-on...',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 1. Write job metadata
  fs.writeFileSync(path.join(jobDir, 'meta.json'), JSON.stringify(job, null, 2), 'utf8');

  // 2. Write input images to private temporary server storage
  fs.writeFileSync(path.join(jobDir, 'input.json'), JSON.stringify(input), 'utf8');

  // 3. Cache in memory
  memoryCache.set(jobId, job);

  return job;
}

/**
 * Retrieves the job metadata.
 */
export function getJob(jobId: string): GenerationJob | null {
  if (memoryCache.has(jobId)) {
    return memoryCache.get(jobId)!;
  }

  const jobDir = getJobDir(jobId);
  const metaPath = path.join(jobDir, 'meta.json');

  if (fs.existsSync(metaPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as GenerationJob;
      memoryCache.set(jobId, data);
      return data;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Updates job metadata and persists to storage.
 */
export function updateJob(jobId: string, updates: Partial<GenerationJob>): GenerationJob | null {
  const existing = getJob(jobId);
  if (!existing) return null;

  const updated: GenerationJob = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };

  memoryCache.set(jobId, updated);

  const jobDir = getJobDir(jobId);
  ensureDir(jobDir);
  const metaPath = path.join(jobDir, 'meta.json');

  try {
    fs.writeFileSync(metaPath, JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[JobStorage] Failed to write meta.json for ${jobId}:`, err);
  }

  return updated;
}

/**
 * Reads input payload from temporary storage inside the background function.
 */
export function getJobInput(jobId: string): StoredJobInput | null {
  const jobDir = getJobDir(jobId);
  const inputPath = path.join(jobDir, 'input.json');

  if (fs.existsSync(inputPath)) {
    try {
      return JSON.parse(fs.readFileSync(inputPath, 'utf8')) as StoredJobInput;
    } catch (err) {
      console.error(`[JobStorage] Failed to read input.json for ${jobId}:`, err);
      return null;
    }
  }
  return null;
}

/**
 * Persists final job results and deletes raw input images to prevent disk accumulation.
 */
export function saveJobResult(
  jobId: string,
  result: GenerationJob['result'],
  spaceUsed?: string
): GenerationJob | null {
  const jobDir = getJobDir(jobId);
  ensureDir(jobDir);

  if (result) {
    try {
      fs.writeFileSync(path.join(jobDir, 'result.json'), JSON.stringify(result), 'utf8');
    } catch (err) {
      console.warn(`[JobStorage] Failed to write result.json for ${jobId}:`, err);
    }
  }

  // Enforce cleanup of heavy raw input images now that processing finished
  cleanupJobInputs(jobId);

  return updateJob(jobId, {
    status: 'completed',
    stage: 'Try-On Complete',
    progress: 1.0,
    result,
    spaceUsed,
  });
}

/**
 * Removes temporary input images once processing has finished or failed.
 */
export function cleanupJobInputs(jobId: string) {
  try {
    const jobDir = getJobDir(jobId);
    const inputPath = path.join(jobDir, 'input.json');
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
  } catch {
    // ignore unlink error
  }
}

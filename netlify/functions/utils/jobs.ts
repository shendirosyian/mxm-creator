/**
 * Job state management for MXM CREATOR asynchronous image generation tasks.
 */

export interface GenerationJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stage?: string;
  queuePosition?: number;
  queueMessage?: string;
  progress?: number;
  createdAt: number;
  updatedAt: number;
  result?: {
    images: Array<{ imageUrl: string; index: number; label: string }>;
    primaryImage: string;
    mode?: string;
    aspectRatio?: string;
    warnings?: string[];
    garmentStatus?: Record<string, { applied: boolean; note: string }>;
  };
  error?: string;
  isQuotaExhausted?: boolean;
  isAuthError?: boolean;
  requiresCredentials?: boolean;
}

// In-memory job cache (persists during warm Lambda / server execution)
const jobsMap = new Map<string, GenerationJob>();

// Clean up jobs older than 1 hour
function pruneOldJobs() {
  const oneHourAgo = Date.now() - 3600 * 1000;
  for (const [id, job] of jobsMap.entries()) {
    if (job.updatedAt < oneHourAgo) {
      jobsMap.delete(id);
    }
  }
}

export function createJob(id: string): GenerationJob {
  pruneOldJobs();
  const job: GenerationJob = {
    id,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobsMap.set(id, job);
  return job;
}

export function updateJob(id: string, updates: Partial<GenerationJob>): GenerationJob | null {
  const existing = jobsMap.get(id);
  if (!existing) return null;
  const updated: GenerationJob = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };
  jobsMap.set(id, updated);
  return updated;
}

export function getJob(id: string): GenerationJob | null {
  return jobsMap.get(id) || null;
}

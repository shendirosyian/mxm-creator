/**
 * Unified Job State Management for MXM CREATOR.
 * Proxies to jobStorage.ts to provide disk persistence, dual-layer cache, and retention policy.
 */

export {
  createAndStoreJob,
  getJob,
  updateJob,
  getJobInput,
  saveJobResult,
  cleanupJobInputs,
  pruneExpiredJobs,
} from './jobStorage';

export type { GenerationJob, JobStatus, StoredJobInput } from './jobStorage';

import { createAndStoreJob, getJob, updateJob, type GenerationJob } from './jobStorage';

// Backwards-compatible legacy createJob alias
export function createJob(id: string): GenerationJob {
  return createAndStoreJob(id, {
    player: { data: '' },
    garments: {},
  });
}

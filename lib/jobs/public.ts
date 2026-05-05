import type { JobDoc } from "@/lib/db/models/Job";
import type { JobStatusResponse } from "@/types/api";

/**
 * Public, client-safe projection of a `JobDoc`. Drops Mongo internals
 * (`_id`, `__v`) and sensitive runtime detail (`error.stack`).
 */
export function toPublicJob(doc: JobDoc): JobStatusResponse {
  return {
    jobId: doc.jobId,
    userId: doc.userId,
    kind: doc.kind,
    state: doc.state,
    progress: doc.progress,
    payload: doc.payload,
    ...(doc.result ? { result: doc.result } : {}),
    ...(doc.error ? { error: { message: doc.error.message } } : {}),
    attempts: doc.attempts,
    ...(doc.startedAt ? { startedAt: doc.startedAt.toISOString() } : {}),
    ...(doc.finishedAt ? { finishedAt: doc.finishedAt.toISOString() } : {}),
    ...(doc.relatedItemId ? { relatedItemId: doc.relatedItemId } : {}),
    ...(doc.relatedVersionId
      ? { relatedVersionId: doc.relatedVersionId }
      : {}),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

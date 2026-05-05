/**
 * Job kinds and payload shapes. Extend as new long-running operations are
 * introduced. Payload unions are discriminated by `kind`.
 */
export const JobKind = {
  Ingest: "ingest",
} as const;

export type JobKind = (typeof JobKind)[keyof typeof JobKind];

export type JobState = "queued" | "running" | "succeeded" | "failed";

export interface IngestJobPayload {
  kind: typeof JobKind.Ingest;
  sourceUrl: string;
  userId: string;
}

/** Discriminated union of every supported job payload. */
export type JobPayload = IngestJobPayload;

/**
 * Minimal in-memory shape for a job document used by the queue runner.
 * Mongoose-backed `Job` model lands in Phase 2; this interface keeps the
 * runner typecheckable in the meantime.
 */
export interface JobLike {
  id: string;
  kind: JobKind;
  state: JobState;
  progress: number;
  payload: JobPayload;
  userId: string;
  itemId?: string;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface JobExecutorContext {
  job: JobLike;
  /** Updates the job's progress (0–100) and any partial fields. */
  updateProgress: (
    progress: number,
    partial?: Partial<JobLike>,
  ) => Promise<void>;
}

export type JobExecutor = (ctx: JobExecutorContext) => Promise<void>;

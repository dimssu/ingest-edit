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
 * In-memory mirror of the persisted Job doc passed to executors. Read-only
 * from the executor's perspective; state mutations flow through context
 * helpers (`updateProgress`, `setResult`) so persistence stays in sync.
 */
export interface JobLike {
  id: string;
  kind: JobKind;
  state: JobState;
  progress: number;
  payload: JobPayload;
  userId: string;
  itemId?: string;
  startedAt?: Date;
}

export interface JobExecutorContext {
  job: JobLike;
  /** Reports progress (0–100). Throttled to ~1 Hz writes; terminal 100 is
   * written by the runner on success — do not call with 100 directly. */
  updateProgress: (progress: number) => Promise<void>;
  /** Stores a result payload that the runner persists on success. May be
   * called multiple times; the last value wins. */
  setResult: (result: Record<string, unknown>) => void;
}

export type JobExecutor = (ctx: JobExecutorContext) => Promise<void>;

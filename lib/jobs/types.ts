/**
 * Job kinds and payload shapes. Extend as new long-running operations are
 * introduced. Payload unions are discriminated by `kind`.
 */
export const JobKind = {
  Ingest: "ingest",
  Render: "render",
  AudioExtract: "audio-extract",
  AudioSwap: "audio-swap",
} as const;

export type JobKind = (typeof JobKind)[keyof typeof JobKind];

export type JobState = "queued" | "running" | "succeeded" | "failed";

export interface IngestJobPayload {
  kind: typeof JobKind.Ingest;
  sourceUrl: string;
  userId: string;
}

/**
 * One clip in a render spec. Local source range `[startMs, endMs)` is
 * sliced out of the source version's underlying file.
 */
export interface RenderJobClip {
  sourceVersionId: string;
  startMs: number;
  endMs: number;
}

export interface RenderJobPayload {
  kind: typeof JobKind.Render;
  userId: string;
  itemId: string;
  baseVersionId: string;
  clips: RenderJobClip[];
  /** Optional human-readable label for the new Version. */
  label?: string;
}

export interface AudioExtractJobPayload {
  kind: typeof JobKind.AudioExtract;
  userId: string;
  itemId: string;
  versionId: string;
  /** Optional human-readable label for the new AudioAsset. */
  label?: string;
}

export interface AudioSwapJobPayload {
  kind: typeof JobKind.AudioSwap;
  userId: string;
  itemId: string;
  versionId: string;
  audioAssetId: string;
  /** Optional human-readable label for the new Version. */
  label?: string;
}

/** Discriminated union of every supported job payload. */
export type JobPayload =
  | IngestJobPayload
  | RenderJobPayload
  | AudioExtractJobPayload
  | AudioSwapJobPayload;

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

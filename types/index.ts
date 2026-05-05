/**
 * Shared, app-wide types. Specific feature types belong next to their
 * implementation; only put cross-cutting types here.
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, "UserId">;
export type ItemId = Brand<string, "ItemId">;
export type VersionId = Brand<string, "VersionId">;
export type JobId = Brand<string, "JobId">;
export type AudioAssetId = Brand<string, "AudioAssetId">;

/**
 * Public, client-facing shape of a job. Strips Mongo-internal fields
 * (`_id`, `__v`) and any sensitive runtime details (`error.stack`) that
 * should never be exposed over the wire.
 */
export interface JobStatus {
  jobId: string;
  userId: string;
  kind: string;
  state: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message: string };
  attempts: number;
  startedAt?: string;
  finishedAt?: string;
  relatedItemId?: string;
  relatedVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

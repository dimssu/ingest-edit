import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import type { JobKind, JobState } from "@/lib/jobs/types";

/**
 * Persistable enums for Mongoose. Hardcoded literal arrays (matched against
 * the type unions in `lib/jobs/types.ts`) so iteration order is stable and
 * additions to either side trigger a TS error here.
 */
export const JOB_KINDS = [
  "ingest",
  "render",
  "audio-extract",
  "audio-swap",
] as const satisfies ReadonlyArray<JobKind>;
export const JOB_STATES = [
  "queued",
  "running",
  "succeeded",
  "failed",
] as const satisfies ReadonlyArray<JobState>;

export interface JobErrorInfo {
  message: string;
  stack?: string;
}

/**
 * Persisted job record. The runner holds the executor in-memory but mirrors
 * every state transition here so jobs survive process restarts and can be
 * surfaced to the UI for polling.
 */
/**
 * Branded ids (`JobId`, `UserId`, `ItemId`, `VersionId`) are typed as plain
 * `string` here for Mongoose generic compatibility. Higher layers narrow.
 */
export interface JobDoc {
  jobId: string;
  userId: string;
  kind: JobKind;
  state: JobState;
  progress: number;
  // reason: payload is a discriminated union (`JobPayload`); the schema
  // stores it loosely so the runner can narrow it per `kind` without
  // forcing every reader to thread the full union through Mongoose generics.
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: JobErrorInfo;
  attempts: number;
  startedAt?: Date;
  finishedAt?: Date;
  relatedItemId?: string;
  relatedVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobModel extends Model<JobDoc> {
  /**
   * On boot, flips any `running` jobs left behind by a crashed worker to
   * `failed` so the UI doesn't render them as in-flight forever. Returns
   * the count of jobs modified.
   */
  markOrphanedAsFailed(): Promise<number>;
}

const jobErrorSchema = new Schema<JobErrorInfo>(
  {
    message: { type: String, required: true },
    stack: { type: String },
  },
  { _id: false },
);

const jobSchema = new Schema<JobDoc, JobModel>(
  {
    jobId: { type: String, required: true, unique: true, immutable: true },
    userId: { type: String, required: true },
    kind: { type: String, required: true, enum: JOB_KINDS },
    state: {
      type: String,
      required: true,
      enum: JOB_STATES,
      default: "queued",
    },
    progress: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    payload: { type: Schema.Types.Mixed, required: true, default: {} },
    result: { type: Schema.Types.Mixed },
    error: { type: jobErrorSchema },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    relatedItemId: { type: String },
    relatedVersionId: { type: String },
  },
  { timestamps: true, collection: "jobs" },
);

// Indexes — `jobId` unique index is declared on the field above.
// Find stuck running jobs at boot; preserves queue order for replays.
jobSchema.index({ state: 1, createdAt: 1 });
// User-facing job history (most recent first).
jobSchema.index({ userId: 1, createdAt: -1 });
// Ops dashboards: how many ingests are queued/failed?
jobSchema.index({ kind: 1, state: 1 });
jobSchema.index({ relatedItemId: 1 });

jobSchema.statics.markOrphanedAsFailed = async function (
  this: JobModel,
): Promise<number> {
  const result = await this.updateMany(
    { state: "running" },
    {
      $set: {
        state: "failed",
        error: {
          message: "Worker process crashed before this job completed.",
        },
        finishedAt: new Date(),
      },
    },
  );
  return result.modifiedCount;
};

export type JobDocument = HydratedDocument<JobDoc>;

export const Job: JobModel =
  (mongoose.models.Job as JobModel | undefined) ??
  mongoose.model<JobDoc, JobModel>("Job", jobSchema);

import { connectDB } from "@/lib/db";
import { Job, type JobDoc } from "@/lib/db/models/Job";
import { getJobQueue } from "@/lib/jobs/queue";
import type {
  JobExecutor,
  JobExecutorContext,
  JobKind,
  JobLike,
  JobPayload,
} from "@/lib/jobs/types";
import { child } from "@/lib/server/logger";
import type { JobId, UserId } from "@/types";

/**
 * Minimum interval between progress writes to Mongo. Progress callbacks fire
 * far more often than is useful to persist; we throttle to ~1 Hz. The first
 * call always writes through.
 */
const PROGRESS_PERSIST_INTERVAL_MS = 1000;

export interface EnqueueJobInput {
  jobId: JobId;
  kind: JobKind;
  userId: UserId;
  payload: JobPayload;
  executor: JobExecutor;
  relatedItemId?: string;
  relatedVersionId?: string;
}

/**
 * Persists a new `queued` job doc, then schedules `executor` on the
 * in-process queue. The returned promise resolves when the executor
 * completes (or rejects on failure). Fire-and-forget callers can ignore it.
 */
export async function enqueueJob(input: EnqueueJobInput): Promise<void> {
  await connectDB();

  const { jobId, kind, userId, payload, executor } = input;

  await Job.create({
    jobId,
    kind,
    userId,
    state: "queued",
    progress: 0,
    // reason: `JobPayload` is a discriminated union without an index
    // signature, but the schema stores it as a loose `Record<string, unknown>`.
    payload: payload as unknown as Record<string, unknown>,
    attempts: 0,
    relatedItemId: input.relatedItemId,
    relatedVersionId: input.relatedVersionId,
  });

  const queue = getJobQueue();
  const log = child({ jobId, jobKind: kind, userId });
  log.info({ state: "queued" }, "Job queued");

  await queue.add(() => runJob({ jobId, kind, userId, payload, executor }));
}

interface RunJobInput {
  jobId: JobId;
  kind: JobKind;
  userId: UserId;
  payload: JobPayload;
  executor: JobExecutor;
}

async function runJob(input: RunJobInput): Promise<void> {
  const { jobId, kind, userId, payload, executor } = input;
  const log = child({ jobId, jobKind: kind, userId });

  // Atomically claim the job: only the first worker to flip queued->running
  // wins. If the doc is already running/succeeded/failed/cancelled we skip.
  const claimed = await Job.findOneAndUpdate(
    { jobId, state: "queued" },
    {
      $set: { state: "running", startedAt: new Date() },
      $inc: { attempts: 1 },
    },
    { new: true },
  ).lean<JobDoc>();

  if (!claimed) {
    log.warn(
      "Job no longer in queued state at dispatch time; skipping (already started or cancelled)",
    );
    return;
  }

  log.info({ state: "running", attempts: claimed.attempts }, "Job started");

  // In-memory mirror of the persisted doc so executors can read fields
  // without a round-trip. Mutations flow through ctx helpers below.
  const jobMirror: JobLike = {
    id: jobId,
    kind,
    state: "running",
    progress: claimed.progress,
    payload,
    userId,
    startedAt: claimed.startedAt,
  };

  // The terminal success/failure write owns the closing transition. Once
  // `finished` flips, late progress writes are dropped to avoid a stale
  // `progress: 99` landing after `state: succeeded`.
  let finished = false;
  let lastProgressPersistAt = 0;
  let pendingResult: Record<string, unknown> | undefined;

  const ctx: JobExecutorContext = {
    job: jobMirror,
    updateProgress: async (progress) => {
      if (finished) return;
      // Reserve 100 for the terminal write; clamp executor-reported values
      // into [0, 99] so a premature 100 can't pre-empt the success path.
      const clamped = Math.max(0, Math.min(99, progress));
      jobMirror.progress = clamped;

      const now = Date.now();
      if (now - lastProgressPersistAt < PROGRESS_PERSIST_INTERVAL_MS) return;
      lastProgressPersistAt = now;

      if (finished) return;
      try {
        await Job.updateOne({ jobId }, { $set: { progress: clamped } });
      } catch (err: unknown) {
        log.warn({ err }, "Failed to persist job progress; continuing");
      }
      log.debug({ progress: clamped }, "Job progress");
    },
    setResult: (result) => {
      pendingResult = result;
    },
  };

  try {
    await executor(ctx);
    finished = true;
    const finishedAt = new Date();
    await Job.updateOne(
      { jobId },
      {
        $set: {
          state: "succeeded",
          progress: 100,
          finishedAt,
          ...(pendingResult ? { result: pendingResult } : {}),
        },
      },
    );
    log.info({ state: "succeeded" }, "Job succeeded");
  } catch (err: unknown) {
    finished = true;
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const finishedAt = new Date();
    try {
      await Job.updateOne(
        { jobId },
        {
          $set: {
            state: "failed",
            finishedAt,
            error: stack ? { message, stack } : { message },
          },
        },
      );
    } catch (persistErr: unknown) {
      log.error(
        { err: persistErr },
        "Failed to persist job failure; original error still rethrown",
      );
    }
    log.error({ state: "failed", err }, "Job failed");
    throw err;
  }
}

/**
 * Returns a read-only snapshot of the persisted job doc. Useful for the
 * polling endpoint. Returns `null` if no such job exists.
 */
export async function getJob(jobId: string): Promise<JobDoc | null> {
  await connectDB();
  return Job.findOne({ jobId }).lean<JobDoc>().exec();
}

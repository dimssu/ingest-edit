import { getJobQueue } from "@/lib/jobs/queue";
import type {
  JobExecutor,
  JobExecutorContext,
  JobLike,
} from "@/lib/jobs/types";
import { child } from "@/lib/server/logger";

// TODO Phase 2: import the Mongoose `Job` model and persist state
// transitions (queued -> running -> succeeded/failed), progress updates,
// startedAt/finishedAt, and error messages.

/**
 * Schedules `executor` to run on the in-process job queue using `jobDoc` as
 * the runtime context. For now state transitions are logged only; in Phase 2
 * they will write through to MongoDB so jobs survive process restarts.
 *
 * Returns a promise that resolves when the executor completes (or rejects on
 * failure). Callers that just want fire-and-forget should ignore the promise.
 */
export async function enqueueJob(
  jobDoc: JobLike,
  executor: JobExecutor,
): Promise<void> {
  const queue = getJobQueue();
  const log = child({
    jobId: jobDoc.id,
    jobKind: jobDoc.kind,
    userId: jobDoc.userId,
    itemId: jobDoc.itemId,
  });

  log.info({ state: "queued" }, "Job queued");

  await queue.add(async () => {
    jobDoc.state = "running";
    jobDoc.startedAt = new Date();
    log.info({ state: "running" }, "Job started");

    const ctx: JobExecutorContext = {
      job: jobDoc,
      updateProgress: async (progress, partial) => {
        jobDoc.progress = Math.max(0, Math.min(100, progress));
        if (partial) Object.assign(jobDoc, partial);
        log.debug(
          { progress: jobDoc.progress },
          "Job progress",
        );
        // TODO Phase 2: persist progress to Mongo here.
      },
    };

    try {
      await executor(ctx);
      jobDoc.state = "succeeded";
      jobDoc.progress = 100;
      jobDoc.finishedAt = new Date();
      log.info({ state: "succeeded" }, "Job succeeded");
    } catch (err: unknown) {
      jobDoc.state = "failed";
      jobDoc.finishedAt = new Date();
      jobDoc.error = err instanceof Error ? err.message : String(err);
      log.error({ state: "failed", err }, "Job failed");
      throw err;
    }
  });
}

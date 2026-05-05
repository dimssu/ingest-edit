import PQueue from "p-queue";
import { connectDB } from "@/lib/db";
import { Job } from "@/lib/db/models/Job";
import { env } from "@/lib/server/env";
import { logger } from "@/lib/server/logger";

declare global {
  var __jobQueue: PQueue | undefined;
}

/**
 * Returns the singleton in-process job queue. Concurrency comes from
 * `JOB_CONCURRENCY` (default 2). Cached on `globalThis` so HMR does not
 * spawn duplicate queues during development.
 */
export function getJobQueue(): PQueue {
  if (globalThis.__jobQueue) return globalThis.__jobQueue;
  const concurrency = env.JOB_CONCURRENCY;
  const queue = new PQueue({ concurrency });
  logger.info({ concurrency }, "Job queue initialized");
  globalThis.__jobQueue = queue;
  return queue;
}

/**
 * One-time queue boot: connect to Mongo, mark any orphaned `running` jobs
 * as failed (process restart cleanup), and report queued jobs left over.
 *
 * Intentionally NOT auto-invoked at import time. A server-side bootstrap
 * (Phase 3) is responsible for calling `boot()` once per process. We do
 * not auto-requeue queued jobs here because there's no cross-process
 * executor registry — a queued job needs the original caller to re-arm
 * its executor.
 */
export async function boot(): Promise<void> {
  await connectDB();

  const orphanedCount = await Job.markOrphanedAsFailed();
  if (orphanedCount > 0) {
    logger.warn(
      { orphanedCount },
      "Marked orphaned running jobs as failed at boot",
    );
  } else {
    logger.info("No orphaned running jobs at boot");
  }

  const queuedCount = await Job.countDocuments({ state: "queued" });
  if (queuedCount > 0) {
    logger.info(
      { queuedCount },
      "Found queued jobs at boot, leaving for explicit replay",
    );
  }
}

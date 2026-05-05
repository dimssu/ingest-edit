import PQueue from "p-queue";
import { env } from "@/lib/server/env";
import { logger } from "@/lib/server/logger";

declare global {
  // eslint-disable-next-line no-var
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

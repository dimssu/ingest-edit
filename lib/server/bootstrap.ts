import { connectDB } from "@/lib/db";
import { boot } from "@/lib/jobs/queue";
import { logger } from "@/lib/server/logger";

declare global {
  var __serverBootPromise: Promise<void> | undefined;
}

/**
 * One-shot, process-wide server bootstrap. Connects to Mongo, then runs the
 * job queue boot (orphan cleanup, queued-job census). Cached on
 * `globalThis` so HMR + repeated route handler invocations share a single
 * promise.
 *
 * Idempotent: every caller awaits the same promise.
 *
 * If boot fails, the cached promise is cleared so the next caller can retry
 * (e.g. after env changes during dev).
 */
export function bootServer(): Promise<void> {
  if (globalThis.__serverBootPromise) {
    return globalThis.__serverBootPromise;
  }

  const promise = (async () => {
    logger.info("Server bootstrap starting");
    await connectDB();
    await boot();
    logger.info("Server bootstrap complete");
  })().catch((err: unknown) => {
    // Clear so a later request can retry (e.g. after env is fixed in dev).
    globalThis.__serverBootPromise = undefined;
    throw err;
  });

  globalThis.__serverBootPromise = promise;
  return promise;
}

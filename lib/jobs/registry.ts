import { audioExtractExecutor } from "@/lib/jobs/executors/audio-extract";
import { audioSwapExecutor } from "@/lib/jobs/executors/audio-swap";
import { ingestExecutor } from "@/lib/jobs/executors/ingest";
import { renderExecutor } from "@/lib/jobs/executors/render";
import type { JobExecutor, JobKind } from "@/lib/jobs/types";

/**
 * Static map from `JobKind` to its in-process executor. Adding a new kind
 * means adding it to `JobKind`, the union in `JobPayload`, and a row here.
 *
 * Kept as a separate module so future boot-recovery code can iterate
 * registered kinds without pulling in the API route layer.
 */
const registry: Partial<Record<JobKind, JobExecutor>> = {
  ingest: ingestExecutor,
  render: renderExecutor,
  "audio-extract": audioExtractExecutor,
  "audio-swap": audioSwapExecutor,
};

/**
 * Returns the executor for `kind`. Throws if no executor is registered —
 * this is a programmer error, not a runtime input issue.
 */
export function getExecutor(kind: JobKind): JobExecutor {
  const exec = registry[kind];
  if (!exec) {
    throw new Error(`No executor registered for job kind: ${kind}`);
  }
  return exec;
}

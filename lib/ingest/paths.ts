import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Per-job working directory. Lives under the OS temp dir so cleanup is best
 * effort even if the explicit `cleanupTempDir` step is skipped.
 *
 *   <tmpdir>/ingest-edit/<jobId>
 */
export function tempDirForJob(jobId: string): string {
  return path.join(os.tmpdir(), "ingest-edit", jobId);
}

/**
 * Creates the per-job temp directory (recursive) and returns its absolute
 * path. Idempotent — safe to call on a directory that already exists.
 */
export async function ensureTempDir(jobId: string): Promise<string> {
  const dir = tempDirForJob(jobId);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Removes the per-job temp directory and everything under it. Swallows
 * errors so cleanup never fails the surrounding job.
 */
export async function cleanupTempDir(jobIdOrPath: string): Promise<void> {
  const dir = path.isAbsolute(jobIdOrPath)
    ? jobIdOrPath
    : tempDirForJob(jobIdOrPath);
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch {
    // intentional: cleanup is best effort.
  }
}

import { spawn } from "node:child_process";

/** stderr tail captured on non-zero exit (KB). */
const STDERR_TAIL_BYTES = 4 * 1024;

export interface FfmpegRunResult {
  /** Process exit code (0 on success). */
  code: number;
  /** Signal that terminated the process, if any. */
  signal: NodeJS.Signals | null;
  /** Tail of stderr (last `STDERR_TAIL_BYTES`). */
  stderrTail: string;
}

/**
 * Spawns `bin` with `args` (no shell), captures the tail of stderr, and
 * resolves on close regardless of exit code so callers can branch on
 * success vs. failure (e.g. "try -c copy first, fall back to re-encode on
 * failure"). Rejects only when the process fails to start.
 */
export function runFfmpegRaw(
  bin: string,
  args: string[],
): Promise<FfmpegRunResult> {
  return new Promise<FfmpegRunResult>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderrTail = "";
    child.stderr?.on("data", (c: Buffer) => {
      stderrTail += c.toString("utf8");
      if (stderrTail.length > STDERR_TAIL_BYTES) {
        stderrTail = stderrTail.slice(-STDERR_TAIL_BYTES);
      }
    });
    child.on("error", (err) =>
      reject(
        new Error(
          `ffmpeg failed to start (${bin}): ${err instanceof Error ? err.message : String(err)}`,
        ),
      ),
    );
    child.on("close", (code, signal) => {
      resolve({
        code: typeof code === "number" ? code : -1,
        signal,
        stderrTail: stderrTail.trim(),
      });
    });
  });
}

/**
 * Convenience wrapper around `runFfmpegRaw` that throws on non-zero exit
 * with a useful error including the stderr tail and a `label` describing
 * what was being attempted.
 */
export async function runFfmpegOrThrow(
  bin: string,
  args: string[],
  label: string,
): Promise<void> {
  const result = await runFfmpegRaw(bin, args);
  if (result.code !== 0) {
    throw new Error(
      `ffmpeg ${label} exited with code ${result.code}${result.signal ? ` (signal ${result.signal})` : ""}. stderr: ${result.stderrTail}`,
    );
  }
}

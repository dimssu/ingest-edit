import { spawn } from "node:child_process";

/** stderr tail captured on non-zero exit (KB). */
const STDERR_TAIL_BYTES = 4 * 1024;

/** Default per-op ffmpeg timeout. Overridable per call. */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** Grace window between SIGTERM and SIGKILL when a timeout fires. */
const KILL_GRACE_MS = 2_000;

export interface FfmpegRunResult {
  /** Process exit code (0 on success). */
  code: number;
  /** Signal that terminated the process, if any. */
  signal: NodeJS.Signals | null;
  /** Tail of stderr (last `STDERR_TAIL_BYTES`). */
  stderrTail: string;
}

export interface FfmpegRunOptions {
  /**
   * Hard wall-clock cap for this spawn. On expiry we send SIGTERM and,
   * after a 2s grace, SIGKILL, then reject the promise with an error
   * containing `"timeout"`. Defaults to `DEFAULT_TIMEOUT_MS` (5 minutes).
   */
  timeoutMs?: number;
}

/**
 * Spawns `bin` with `args` (no shell), captures the tail of stderr, and
 * resolves on close regardless of exit code so callers can branch on
 * success vs. failure (e.g. "try -c copy first, fall back to re-encode on
 * failure"). Rejects only when the process fails to start OR when the
 * `timeoutMs` budget is exceeded.
 *
 * Spawn uses `detached: true` so ffmpeg runs in its own process group;
 * timeout cleanup signals the whole group via `process.kill(-pid, ...)` so
 * any helper subprocesses ffmpeg might have forked are taken down too.
 * The parent stays attached so Node still reaps the child PID normally.
 *
 * The rejection messages on timeout include `bin` + argv so log readers
 * can see what was running. Treat those messages as **log-grade**, not
 * user-grade — the http error responder sanitizes them at the route
 * boundary in production, but callers should not surface them directly.
 */
export function runFfmpegRaw(
  bin: string,
  args: string[],
  options: FfmpegRunOptions = {},
): Promise<FfmpegRunResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<FfmpegRunResult>((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ["ignore", "ignore", "pipe"],
      detached: true,
    });

    let stderrTail = "";
    let timedOut = false;
    let killTimer: NodeJS.Timeout | null = null;
    let settled = false;

    const clearTimers = (): void => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      if (killTimer) {
        clearTimeout(killTimer);
        killTimer = null;
      }
    };

    /**
     * Signal the whole process group when we have a leader pid. Falls back
     * to leader-only on platforms that don't support negative-pid signals
     * or when the leader is already gone.
     */
    const signalGroup = (signal: NodeJS.Signals): void => {
      const pid = child.pid;
      if (pid === undefined) return;
      try {
        process.kill(-pid, signal);
        return;
      } catch {
        // Group signal failed (e.g. group leader already exited, or
        // platform doesn't support it). Try the leader directly.
      }
      try {
        child.kill(signal);
      } catch {
        // Already exited — harmless.
      }
    };

    const timeoutTimer: NodeJS.Timeout = setTimeout(() => {
      timedOut = true;
      // Politely first — to the whole group so helpers go too.
      signalGroup("SIGTERM");
      // If it's still around after the grace window, take it down hard.
      killTimer = setTimeout(() => {
        signalGroup("SIGKILL");
      }, KILL_GRACE_MS);
    }, timeoutMs);

    child.stderr?.on("data", (c: Buffer) => {
      stderrTail += c.toString("utf8");
      if (stderrTail.length > STDERR_TAIL_BYTES) {
        stderrTail = stderrTail.slice(-STDERR_TAIL_BYTES);
      }
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimers();
      reject(
        new Error(
          `ffmpeg failed to start (${bin}): ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimers();

      if (timedOut) {
        const cmdPreview = `${bin} ${args.join(" ")}`;
        reject(
          new Error(
            `ffmpeg exceeded ${timeoutMs}ms timeout (cmd: ${cmdPreview}). Killed. stderr: ${stderrTail.trim()}`,
          ),
        );
        return;
      }

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
 * what was being attempted. Forwards the optional `timeoutMs`.
 */
export async function runFfmpegOrThrow(
  bin: string,
  args: string[],
  label: string,
  options: FfmpegRunOptions = {},
): Promise<void> {
  const result = await runFfmpegRaw(bin, args, options);
  if (result.code !== 0) {
    throw new Error(
      `ffmpeg ${label} exited with code ${result.code}${result.signal ? ` (signal ${result.signal})` : ""}. stderr: ${result.stderrTail}`,
    );
  }
}

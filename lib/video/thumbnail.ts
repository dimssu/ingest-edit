import { spawn } from "node:child_process";
import { env } from "@/lib/server/env";

/** Thumbnail should be near-instant; 30s is more than enough headroom. */
const DEFAULT_THUMBNAIL_TIMEOUT_MS = 30_000;
const KILL_GRACE_MS = 2_000;

export interface ThumbnailOptions {
  /** Override the default 30s timeout. */
  timeoutMs?: number;
}

/**
 * Extracts a single JPEG frame from `input` at `atSeconds` and writes it to
 * `output`. Throws on non-zero ffmpeg exit, or when the spawn exceeds
 * `timeoutMs` (default 30s — single-frame extraction should be near-
 * instant). Always overwrites (`-y`).
 *
 * `-ss` is placed before `-i` for fast input-side seeking, which is
 * dramatically faster than the alternative on long sources.
 */
export async function extractThumbnail(
  input: string,
  output: string,
  atSeconds = 1,
  options: ThumbnailOptions = {},
): Promise<void> {
  const bin = env.FFMPEG_PATH ?? "ffmpeg";
  const timeoutMs = options.timeoutMs ?? DEFAULT_THUMBNAIL_TIMEOUT_MS;
  const args = [
    "-ss",
    String(atSeconds),
    "-i",
    input,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    "-y",
    output,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ["ignore", "ignore", "pipe"],
      detached: true,
    });
    let stderr = "";
    let timedOut = false;
    let killTimer: NodeJS.Timeout | null = null;
    let settled = false;

    const clearTimers = (): void => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (killTimer) {
        clearTimeout(killTimer);
        killTimer = null;
      }
    };

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
        // Process may already be gone.
      }
      killTimer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // Already exited.
        }
      }, KILL_GRACE_MS);
    }, timeoutMs);

    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
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
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimers();
      if (timedOut) {
        reject(
          new Error(
            `ffmpeg thumbnail extraction exceeded ${timeoutMs}ms timeout (cmd: ${bin} ...). Killed. stderr: ${stderr.trim()}`,
          ),
        );
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `ffmpeg thumbnail extraction exited with code ${code ?? "null"}. stderr: ${stderr.trim()}`,
          ),
        );
        return;
      }
      resolve();
    });
  });
}

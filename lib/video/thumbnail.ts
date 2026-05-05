import { spawn } from "node:child_process";
import { env } from "@/lib/server/env";

/**
 * Extracts a single JPEG frame from `input` at `atSeconds` and writes it to
 * `output`. Throws on non-zero ffmpeg exit. Always overwrites (`-y`).
 *
 * `-ss` is placed before `-i` for fast input-side seeking, which is
 * dramatically faster than the alternative on long sources.
 */
export async function extractThumbnail(
  input: string,
  output: string,
  atSeconds = 1,
): Promise<void> {
  const bin = env.FFMPEG_PATH ?? "ffmpeg";
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
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", (err) =>
      reject(
        new Error(
          `ffmpeg failed to start (${bin}): ${err instanceof Error ? err.message : String(err)}`,
        ),
      ),
    );
    child.on("close", (code) => {
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

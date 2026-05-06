import { env } from "@/lib/server/env";
import { runFfmpegOrThrow } from "@/lib/video/ffmpeg-run";

export interface TrimClipOptions {
  input: string;
  output: string;
  /** Inclusive start in milliseconds. */
  startMs: number;
  /** Exclusive end in milliseconds. Must be greater than `startMs`. */
  endMs: number;
  /** Override the default ffmpeg-run timeout (5 minutes). */
  timeoutMs?: number;
}

/**
 * Trims `[startMs, endMs)` out of `input` into `output` via stream-copy.
 *
 * Implementation notes:
 *
 *   - `-ss <start>` is placed BEFORE `-i` for fast input-side seeking.
 *   - We pass duration via `-t` (rather than `-to`) so the contract is
 *     unambiguous regardless of `-ss` placement.
 *   - With `-c copy`, ffmpeg snaps `-ss` to the nearest preceding keyframe.
 *     Trims are therefore keyframe-accurate, NOT sample-accurate. For short
 *     Instagram videos (typical GOP 1–2s) the imprecision is acceptable. If
 *     a future spec needs sample-accurate cuts, add a separate re-encode
 *     mode behind a flag — never silently re-encode here, because that
 *     breaks our quality-preservation contract.
 *   - `-avoid_negative_ts make_zero` rebases the trimmed stream's
 *     timestamps so downstream concat doesn't choke on negative PTS.
 */
export async function trimClip(opts: TrimClipOptions): Promise<void> {
  const { input, output, startMs, endMs, timeoutMs } = opts;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error(
      `trimClip: non-finite range (startMs=${startMs}, endMs=${endMs}).`,
    );
  }
  if (endMs <= startMs) {
    throw new Error(
      `trimClip: endMs (${endMs}) must be greater than startMs (${startMs}).`,
    );
  }

  const startSeconds = (startMs / 1000).toFixed(3);
  const durationSeconds = ((endMs - startMs) / 1000).toFixed(3);
  const bin = env.FFMPEG_PATH ?? "ffmpeg";
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    startSeconds,
    "-i",
    input,
    "-t",
    durationSeconds,
    "-c",
    "copy",
    "-avoid_negative_ts",
    "make_zero",
    "-map",
    "0",
    "-y",
    output,
  ];

  await runFfmpegOrThrow(bin, args, "trim", { timeoutMs });
}

import path from "node:path";
import { env } from "@/lib/server/env";
import {
  runFfmpegOrThrow,
  runFfmpegRaw,
} from "@/lib/video/ffmpeg-run";

/**
 * Audio container/extension picked for a given source codec. Mirrors the
 * `AudioFormat` enum in `lib/db/models/AudioAsset.ts`.
 */
export type ExtractAudioFormat = "m4a" | "mp3" | "ogg" | "wav" | "flac";

export interface ExtractAudioOptions {
  input: string;
  /**
   * Output path WITHOUT extension. The extension is appended based on the
   * source audio codec. Returned in the result so the caller knows the
   * final path + format.
   */
  outputBase: string;
  /**
   * Optional codec hint from a prior probe to skip the internal probe. The
   * extension is chosen from this hint and `-acodec copy` is attempted.
   */
  sourceCodecHint?: string;
  /**
   * Quality policy: stream-copy only by default. Set true to allow a
   * fallback mp3 re-encode (192 kbps) when the source codec can't be
   * stream-copied into a known container. Default false so unknown codecs
   * surface as a clear error rather than a silent quality hit.
   */
  allowReencode?: boolean;
  /** Override the default ffmpeg-run timeout (5 minutes) for each pass. */
  timeoutMs?: number;
}

export interface ExtractAudioResult {
  outputPath: string;
  format: ExtractAudioFormat;
  /** Whether we re-encoded (mp3 fallback) or stream-copied. */
  reencoded: boolean;
}

/**
 * Extracts the audio track of `input` into a file derived from `outputBase`.
 *
 *   - Picks an extension matching the source audio codec (aac → m4a,
 *     mp3 → mp3, opus → ogg, ...) and uses `-vn -acodec copy` for a
 *     bit-exact extraction.
 *   - If the source codec is unknown, or the stream-copy fails, throws an
 *     error unless `allowReencode` is set, in which case it falls back to
 *     mp3 at 192 kbps.
 */
export async function extractAudio(
  opts: ExtractAudioOptions,
): Promise<ExtractAudioResult> {
  const { input, outputBase, sourceCodecHint, timeoutMs } = opts;
  const allowReencode = opts.allowReencode ?? false;
  const bin = env.FFMPEG_PATH ?? "ffmpeg";

  const codecLower = (sourceCodecHint ?? "").toLowerCase();
  const copyTarget = pickCopyExtension(codecLower);

  if (copyTarget) {
    const outputPath = `${outputBase}.${copyTarget}`;
    const copyArgs = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input,
      "-vn",
      "-acodec",
      "copy",
      "-y",
      outputPath,
    ];
    const copyResult = await runFfmpegRaw(bin, copyArgs, { timeoutMs });
    if (copyResult.code === 0) {
      return { outputPath, format: copyTarget, reencoded: false };
    }
    if (!allowReencode) {
      throw new Error(
        `Audio stream-copy of codec "${codecLower}" failed. Re-encoding is ` +
          `disabled by default to preserve quality. ffmpeg exit ` +
          `${copyResult.code}. stderr: ${copyResult.stderrTail}`,
      );
    }
    // else: fall through to mp3 fallback below
  } else if (!allowReencode) {
    throw new Error(
      `Source audio codec "${codecLower || "(unknown)"}" has no known ` +
        `stream-copy container. Pass allowReencode to mp3-encode at 192 kbps.`,
    );
  }

  const mp3Path = `${outputBase}.mp3`;
  const encodeArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    input,
    "-vn",
    "-acodec",
    "libmp3lame",
    "-b:a",
    "192k",
    "-y",
    mp3Path,
  ];
  await runFfmpegOrThrow(bin, encodeArgs, "audio-extract (mp3 fallback)", {
    timeoutMs,
  });
  return { outputPath: mp3Path, format: "mp3", reencoded: true };
}

/**
 * Maps a probed codec name to an extension that ffmpeg can mux a copy
 * stream into without re-encoding. Returns null when we don't have a
 * known-safe pairing (caller will fall back to mp3).
 */
function pickCopyExtension(codec: string): ExtractAudioFormat | null {
  switch (codec) {
    case "aac":
    case "alac":
      return "m4a";
    case "mp3":
      return "mp3";
    case "opus":
    case "vorbis":
      return "ogg";
    case "pcm_s16le":
    case "pcm_s24le":
    case "pcm_f32le":
      return "wav";
    case "flac":
      return "flac";
    default:
      return null;
  }
}

/** For callers that have only the file path and want a sensible default base. */
export function defaultOutputBase(inputPath: string, assetId: string): string {
  return path.join(path.dirname(inputPath), `audio-${assetId}`);
}

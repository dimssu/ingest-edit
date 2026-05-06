import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/server/env";
import { probeVideo } from "@/lib/video/probe";
import { writeConcatList } from "@/lib/video/concat-list";
import {
  runFfmpegOrThrow,
  runFfmpegRaw,
} from "@/lib/video/ffmpeg-run";

export interface ConcatVideosOptions {
  /** Absolute paths to inputs. Order is preserved on the timeline. */
  inputs: string[];
  output: string;
  /**
   * Quality policy: stream-copy only by default. When false (the default),
   * any concat-demuxer failure surfaces as an error so the caller can decide
   * whether re-encoding is acceptable. Set true ONLY when the caller has an
   * explicit user signal to accept lossy re-encoding (CRF 17 visually
   * lossless, but still a re-encode).
   */
  fallbackEncode?: boolean;
  /** Override the default ffmpeg-run timeout (5 minutes) for each pass. */
  timeoutMs?: number;
}

/**
 * Concatenates `inputs` end-to-end into `output`.
 *
 *   - First attempts the ffmpeg concat demuxer with `-c copy`. This works
 *     when every input shares the same codecs / pixel format / dimensions /
 *     framerate / time base, which is the common case for clips trimmed
 *     out of the same source.
 *   - On failure (different codecs / parameters), and when
 *     `fallbackEncode` is true, falls back to re-encoding using the first
 *     input's codec, resolution, and framerate at CRF 17 (visually
 *     lossless). The fallback re-encodes BOTH video and audio in a single
 *     pass — mixing copy and encode for concat across heterogeneous inputs
 *     is not generally safe.
 *
 * The concat-demuxer manifest is written into the same directory as
 * `output` and removed on success.
 */
export async function concatVideos(opts: ConcatVideosOptions): Promise<void> {
  const { inputs, output, timeoutMs } = opts;
  const fallbackEncode = opts.fallbackEncode ?? false;

  if (inputs.length === 0) {
    throw new Error("concatVideos: no inputs supplied.");
  }
  for (const input of inputs) {
    if (!path.isAbsolute(input)) {
      throw new Error(
        `concatVideos: input path must be absolute, got "${input}".`,
      );
    }
  }

  const bin = env.FFMPEG_PATH ?? "ffmpeg";
  const manifestPath = path.join(
    path.dirname(output),
    `concat-${path.basename(output)}.txt`,
  );
  await writeConcatList(manifestPath, inputs);

  const copyArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    manifestPath,
    "-c",
    "copy",
    "-y",
    output,
  ];

  try {
    const copyResult = await runFfmpegRaw(bin, copyArgs, { timeoutMs });
    if (copyResult.code === 0) {
      return;
    }

    if (!fallbackEncode) {
      throw new Error(
        `Concat stream-copy failed (likely heterogeneous codecs across ` +
          `clips). Re-encoding is disabled by default to preserve quality. ` +
          `ffmpeg exit ${copyResult.code}. stderr: ${copyResult.stderrTail}`,
      );
    }

    // Fallback path: probe the first input to learn the target codec /
    // resolution / framerate, then re-encode in a single pass. We use the
    // concat demuxer but allow ffmpeg to re-encode by NOT passing -c copy.
    // (`-vsync cfr` keeps frame timing sane across heterogeneous inputs.)
    const firstMeta = await probeVideo(inputs[0], { timeoutMs });
    const videoCodec = mapCopyableCodecToEncoder(firstMeta.videoCodec);
    const encodeArgs: string[] = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      manifestPath,
      "-c:v",
      videoCodec,
    ];
    if (videoCodec === "libx264" || videoCodec === "libx265") {
      encodeArgs.push("-crf", "17", "-preset", "medium");
    }
    if (firstMeta.framerate && Number.isFinite(firstMeta.framerate)) {
      encodeArgs.push("-r", firstMeta.framerate.toFixed(3));
    }
    if (firstMeta.audioCodec) {
      encodeArgs.push("-c:a", "aac", "-b:a", "192k");
    }
    encodeArgs.push("-pix_fmt", "yuv420p", "-vsync", "cfr", "-y", output);

    await runFfmpegOrThrow(bin, encodeArgs, "concat (re-encode fallback)", {
      timeoutMs,
    });
  } finally {
    await fs.promises
      .rm(manifestPath, { force: true })
      .catch(() => undefined);
  }
}

/**
 * Maps a probed codec name (`h264`, `hevc`, `vp9`, ...) to a libavcodec
 * encoder name (`libx264`, `libx265`, ...). Falls back to `libx264` for
 * anything we don't have a known encoder for — that's the common Instagram
 * case and ffmpeg-installed builds always carry it.
 */
function mapCopyableCodecToEncoder(codec: string | undefined): string {
  switch ((codec ?? "").toLowerCase()) {
    case "h264":
    case "avc1":
      return "libx264";
    case "hevc":
    case "h265":
      return "libx265";
    case "vp9":
      return "libvpx-vp9";
    case "vp8":
      return "libvpx";
    case "av1":
      return "libaom-av1";
    default:
      return "libx264";
  }
}

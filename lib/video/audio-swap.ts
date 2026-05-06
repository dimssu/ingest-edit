import { env } from "@/lib/server/env";
import {
  runFfmpegOrThrow,
  runFfmpegRaw,
} from "@/lib/video/ffmpeg-run";

export interface SwapAudioOptions {
  /** Path to the source video. Its video stream is preserved. */
  videoInput: string;
  /** Path to the audio asset whose audio stream replaces the video's. */
  audioInput: string;
  output: string;
  /**
   * Quality policy: stream-copy both streams by default. Set true to
   * allow a fallback that copies the video stream bit-exact and re-encodes
   * ONLY the audio to AAC 192 kbps when the source audio can't be muxed
   * into the video container. Default false so codec/container mismatches
   * surface as a clear error.
   */
  allowAudioReencode?: boolean;
}

/**
 * Combines the video stream of `videoInput` with the audio stream of
 * `audioInput` into `output`.
 *
 *   - Uses `-map 0:v -map 1:a -c copy`, preserving both streams bit-exact.
 *     Works when the audio codec is muxable into the video container
 *     (e.g. AAC into MP4).
 *   - On copy failure (typical codec/container mismatch) throws unless
 *     `allowAudioReencode` is set, in which case the video is still
 *     stream-copied and ONLY the audio is re-encoded to AAC 192 kbps.
 *   - `-shortest` makes output match the shorter of the two streams; this
 *     mirrors the editor's "swap the audio for the video" intent.
 */
export async function swapAudio(opts: SwapAudioOptions): Promise<void> {
  const { videoInput, audioInput, output } = opts;
  const allowAudioReencode = opts.allowAudioReencode ?? false;
  const bin = env.FFMPEG_PATH ?? "ffmpeg";

  const baseArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    videoInput,
    "-i",
    audioInput,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-shortest",
  ];

  const copyArgs = [
    ...baseArgs,
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "-y",
    output,
  ];

  const copyResult = await runFfmpegRaw(bin, copyArgs);
  if (copyResult.code === 0) {
    return;
  }

  if (!allowAudioReencode) {
    throw new Error(
      `Audio swap stream-copy failed (likely audio codec doesn't fit the ` +
        `video container). Audio re-encode is disabled by default to preserve ` +
        `quality. ffmpeg exit ${copyResult.code}. stderr: ${copyResult.stderrTail}`,
    );
  }

  // Fallback (opt-in): re-encode just the audio. Video stays bit-exact.
  const encodeAudioArgs = [
    ...baseArgs,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-y",
    output,
  ];
  await runFfmpegOrThrow(bin, encodeAudioArgs, "audio-swap (audio re-encode)");
}

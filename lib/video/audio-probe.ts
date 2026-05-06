import { spawn } from "node:child_process";
import fs from "node:fs";
import { env } from "@/lib/server/env";

export interface AudioProbeResult {
  durationMs: number;
  sampleRate?: number;
  channels?: number;
  audioCodec?: string;
  audioBitrate?: number;
  fileSizeBytes: number;
}

interface FfprobeAudioStream {
  codec_type?: string;
  codec_name?: string;
  sample_rate?: string;
  channels?: number;
  bit_rate?: string;
  duration?: string;
}

interface FfprobeJson {
  streams?: FfprobeAudioStream[];
  format?: { duration?: string; bit_rate?: string; size?: string };
}

function toNumberOrUndefined(v: string | undefined): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Probes an audio-only (or video-with-audio) file for its first audio
 * stream. Unlike `probeVideo`, this never throws for the absence of a
 * video stream — it's the right tool for files emitted by `extractAudio`.
 */
export async function probeAudio(filePath: string): Promise<AudioProbeResult> {
  const bin = env.FFPROBE_PATH ?? "ffprobe";
  const args = [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    filePath,
  ];

  const json = await new Promise<string>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", (err) =>
      reject(
        new Error(
          `ffprobe failed to start (${bin}): ${err instanceof Error ? err.message : String(err)}`,
        ),
      ),
    );
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `ffprobe (audio) exited with code ${code ?? "null"}. stderr: ${stderr.trim()}`,
          ),
        );
        return;
      }
      resolve(stdout);
    });
  });

  let parsed: FfprobeJson;
  try {
    parsed = JSON.parse(json) as FfprobeJson;
  } catch (err: unknown) {
    throw new Error(
      `ffprobe produced invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const streams = parsed.streams ?? [];
  const audioStream = streams.find((s) => s.codec_type === "audio");
  if (!audioStream) {
    throw new Error(`ffprobe found no audio stream in ${filePath}`);
  }

  const formatDurationS = toNumberOrUndefined(parsed.format?.duration);
  const streamDurationS = toNumberOrUndefined(audioStream.duration);
  const durationS = formatDurationS ?? streamDurationS ?? 0;
  const durationMs = Math.round(durationS * 1000);

  let fileSizeBytes = toNumberOrUndefined(parsed.format?.size) ?? 0;
  if (fileSizeBytes === 0) {
    try {
      const stat = await fs.promises.stat(filePath);
      fileSizeBytes = stat.size;
    } catch {
      fileSizeBytes = 0;
    }
  }

  return {
    durationMs,
    sampleRate: toNumberOrUndefined(audioStream.sample_rate),
    channels: audioStream.channels,
    audioCodec: audioStream.codec_name,
    audioBitrate: toNumberOrUndefined(audioStream.bit_rate),
    fileSizeBytes,
  };
}

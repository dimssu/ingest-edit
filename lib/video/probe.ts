import { spawn } from "node:child_process";
import fs from "node:fs";
import { env } from "@/lib/server/env";

export interface ProbeResult {
  durationMs: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec?: string;
  framerate?: number;
  videoBitrate?: number;
  audioBitrate?: number;
  fileSizeBytes: number;
}

/**
 * Subset of the ffprobe JSON we care about. Anything not modeled here is
 * ignored — the schema is best-effort and varies across ffmpeg builds.
 */
interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  bit_rate?: string;
  duration?: string;
}

interface FfprobeFormat {
  duration?: string;
  bit_rate?: string;
  size?: string;
}

interface FfprobeJson {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
}

function parseFrameRate(rate: string | undefined): number | undefined {
  if (!rate) return undefined;
  const [n, d] = rate.split("/");
  if (!n || !d) return undefined;
  const num = Number(n);
  const den = Number(d);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
    return undefined;
  }
  return num / den;
}

function toNumberOrUndefined(v: string | undefined): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Probe should be near-instant; 30s is more than enough headroom. */
const DEFAULT_PROBE_TIMEOUT_MS = 30_000;
const KILL_GRACE_MS = 2_000;

export interface ProbeOptions {
  /** Override the default 30s timeout. */
  timeoutMs?: number;
}

/**
 * Spawns ffprobe with a fixed argv (no shell). Parses the JSON output and
 * reduces it to a flat, app-shaped record. Throws on non-zero exit, on
 * unparseable output, or when the spawn exceeds `timeoutMs` (default
 * 30s — probe is metadata-only and should be near-instant).
 */
export async function probeVideo(
  filePath: string,
  options: ProbeOptions = {},
): Promise<ProbeResult> {
  const bin = env.FFPROBE_PATH ?? "ffprobe";
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
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
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    let stdout = "";
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

    child.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimers();
      reject(
        new Error(
          `ffprobe failed to start (${bin}): ${err instanceof Error ? err.message : String(err)}`,
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
            `ffprobe exceeded ${timeoutMs}ms timeout (file: ${filePath}). Killed. stderr: ${stderr.trim()}`,
          ),
        );
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `ffprobe exited with code ${code ?? "null"}. stderr: ${stderr.trim()}`,
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
  const videoStream = streams.find((s) => s.codec_type === "video");
  const audioStream = streams.find((s) => s.codec_type === "audio");

  if (!videoStream) {
    throw new Error(`ffprobe found no video stream in ${filePath}`);
  }

  const formatDurationS = toNumberOrUndefined(parsed.format?.duration);
  const streamDurationS = toNumberOrUndefined(videoStream.duration);
  const durationS = formatDurationS ?? streamDurationS ?? 0;
  const durationMs = Math.round(durationS * 1000);

  const framerate =
    parseFrameRate(videoStream.avg_frame_rate) ??
    parseFrameRate(videoStream.r_frame_rate);

  const videoBitrate = toNumberOrUndefined(videoStream.bit_rate);
  const audioBitrate = audioStream
    ? toNumberOrUndefined(audioStream.bit_rate)
    : undefined;

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
    width: videoStream.width ?? 0,
    height: videoStream.height ?? 0,
    videoCodec: videoStream.codec_name ?? "unknown",
    audioCodec: audioStream?.codec_name,
    framerate,
    videoBitrate,
    audioBitrate,
    fileSizeBytes,
  };
}

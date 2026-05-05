import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Logger } from "pino";
import { env } from "@/lib/server/env";

/**
 * Default timeout for a single yt-dlp invocation. Instagram reels are short
 * but rate limiting can delay things — five minutes is generous without
 * being unbounded.
 */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** stderr tail captured on non-zero exit (KB). */
const STDERR_TAIL_BYTES = 4 * 1024;

export interface DownloadVideoOptions {
  url: string;
  outputDir: string;
  cookiesPath?: string;
  log: Logger;
  /** Override timeout (ms). */
  timeoutMs?: number;
}

export interface DownloadVideoResult {
  filePath: string;
  infoJsonPath: string;
}

/**
 * Spawns yt-dlp with a fixed argv array (no shell), captures stderr tail,
 * parses progress lines from stdout, and on success returns the produced
 * media file plus its sidecar info.json.
 *
 * Throws on non-zero exit, on timeout (process is killed first), or if the
 * expected output files cannot be located after a successful exit.
 */
export async function downloadVideo(
  opts: DownloadVideoOptions,
): Promise<DownloadVideoResult> {
  const { url, outputDir, cookiesPath, log } = opts;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const bin = env.YT_DLP_PATH ?? "yt-dlp";

  const args: string[] = [
    "--no-playlist",
    "--no-warnings",
    "--restrict-filenames",
    "--write-info-json",
    "--newline",
    "--progress-template",
    "download:%(progress.downloaded_bytes)s/%(progress.total_bytes)s",
    "-o",
    path.join(outputDir, "%(id)s.%(ext)s"),
    "--format",
    "bv*+ba/b",
  ];
  if (cookiesPath) {
    args.push("--cookies", cookiesPath);
  }
  args.push(url);

  log.info({ bin, outputDir, hasCookies: Boolean(cookiesPath) }, "yt-dlp start");

  return new Promise<DownloadVideoResult>((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: outputDir,
    });

    let stderrTail = "";
    let stdoutBuf = "";
    let killedForTimeout = false;

    const timer = setTimeout(() => {
      killedForTimeout = true;
      log.warn({ timeoutMs }, "yt-dlp timeout — killing process tree");
      try {
        // Negative pid kills the whole process group, but we didn't detach;
        // SIGKILL on the child still terminates yt-dlp's spawned subprocesses
        // because Node's child_process inherits ownership.
        child.kill("SIGKILL");
      } catch (err: unknown) {
        log.warn({ err }, "Failed to kill yt-dlp on timeout");
      }
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString("utf8");
      // Newline-delimited; drain complete lines.
      let nl = stdoutBuf.indexOf("\n");
      while (nl !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (line.startsWith("download:")) {
          const body = line.slice("download:".length).trim();
          const match = /^(\d+)\/(\d+|NA)$/.exec(body);
          if (match) {
            const downloaded = Number(match[1]);
            const total = match[2] === "NA" ? 0 : Number(match[2]);
            const progress = total > 0 ? (downloaded / total) * 100 : 0;
            log.info({ progress, downloaded, total }, "yt-dlp progress");
          }
        }
        nl = stdoutBuf.indexOf("\n");
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrTail += chunk.toString("utf8");
      if (stderrTail.length > STDERR_TAIL_BYTES) {
        stderrTail = stderrTail.slice(-STDERR_TAIL_BYTES);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          `yt-dlp failed to start (${bin}): ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    });

    child.on("close", async (code, signal) => {
      clearTimeout(timer);

      if (killedForTimeout) {
        reject(
          new Error(
            `yt-dlp timed out after ${timeoutMs}ms. stderr tail: ${stderrTail.trim()}`,
          ),
        );
        return;
      }

      if (code !== 0) {
        reject(
          new Error(
            `yt-dlp exited with code ${code ?? "null"}${signal ? ` (signal ${signal})` : ""}. stderr tail: ${stderrTail.trim()}`,
          ),
        );
        return;
      }

      // Locate the produced media file + matching info.json.
      try {
        const entries = await fs.promises.readdir(outputDir);
        const infoJson = entries.find((e) => e.endsWith(".info.json"));
        if (!infoJson) {
          reject(
            new Error(
              `yt-dlp succeeded but no .info.json was produced in ${outputDir}`,
            ),
          );
          return;
        }
        const stem = infoJson.slice(0, -".info.json".length);
        const media = entries.find(
          (e) =>
            e !== infoJson &&
            !e.endsWith(".part") &&
            (e === stem || e.startsWith(`${stem}.`)),
        );
        if (!media) {
          reject(
            new Error(
              `yt-dlp succeeded but no media file matching ${stem}.* found in ${outputDir}`,
            ),
          );
          return;
        }
        resolve({
          filePath: path.join(outputDir, media),
          infoJsonPath: path.join(outputDir, infoJson),
        });
      } catch (err: unknown) {
        reject(
          err instanceof Error
            ? err
            : new Error(`yt-dlp post-exit scan failed: ${String(err)}`),
        );
      }
    });
  });
}

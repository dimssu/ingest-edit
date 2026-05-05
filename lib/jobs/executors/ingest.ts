import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { connectDB } from "@/lib/db";
import { Item, Version } from "@/lib/db/models";
import { downloadVideo } from "@/lib/ingest/yt-dlp";
import { cleanupTempDir, ensureTempDir } from "@/lib/ingest/paths";
import type { IngestJobPayload, JobExecutor } from "@/lib/jobs/types";
import { env, requireEnv } from "@/lib/server/env";
import { child } from "@/lib/server/logger";
import { originalKey } from "@/lib/storage/keys";
import { uploadStream } from "@/lib/storage/s3";
import { extractThumbnail } from "@/lib/video/thumbnail";
import { probeVideo } from "@/lib/video/probe";

/**
 * Map common video container extensions to their canonical MIME types.
 * Falls back to the AWS default `application/octet-stream` for unknowns.
 */
function guessContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    case "mkv":
      return "video/x-matroska";
    default:
      return "application/octet-stream";
  }
}

/**
 * Ingest job executor. Pipeline:
 *   1. Download via yt-dlp into a per-job temp dir.
 *   2. ffprobe the resulting media.
 *   3. ffmpeg one-frame thumbnail.
 *   4. Stream both originals to S3 under `originals/{userId}/{itemId}/...`.
 *   5. Persist `Item` + root `Version` (op: 'original').
 *   6. setResult({ itemId, versionId }) for the runner to persist.
 *
 * AWS + Mongo creds are asserted up-front so the failure surface is a
 * single clear "missing env" error rather than a partial side-effect.
 *
 * The temp dir is cleaned up in a `finally` regardless of success.
 */
export const ingestExecutor: JobExecutor = async (ctx) => {
  // Narrow the loose payload back to its discriminated form.
  const payload = ctx.job.payload as IngestJobPayload;
  const log = child({
    jobId: ctx.job.id,
    userId: payload.userId,
    sourceUrl: payload.sourceUrl,
  });

  // Fail loud and early if any backing service is missing creds.
  requireEnv(
    "MONGODB_URI",
    "MONGODB_DB_NAME",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "S3_BUCKET",
  );

  const tempDir = await ensureTempDir(ctx.job.id);

  try {
    await ctx.updateProgress(5);

    // 1. Download.
    const { filePath, infoJsonPath } = await downloadVideo({
      url: payload.sourceUrl,
      outputDir: tempDir,
      cookiesPath: env.INSTAGRAM_COOKIES_PATH || undefined,
      log,
    });

    // Defense-in-depth: refuse to touch a symlinked output so a quirky
    // yt-dlp postprocessor can't redirect us to a file outside the temp dir.
    const lstat = await fs.promises.lstat(filePath);
    if (lstat.isSymbolicLink()) {
      throw new Error(
        `yt-dlp produced a symlink at ${filePath}; refusing for safety.`,
      );
    }
    await ctx.updateProgress(50);

    // 2. Probe.
    const meta = await probeVideo(filePath);
    log.info({ meta }, "ffprobe complete");
    await ctx.updateProgress(60);

    // 3. Thumbnail at min(1s, durationMs/2 in seconds) — for very short
    //    clips, the 1s mark may be past the end.
    const thumbAt = Math.min(1, meta.durationMs / 2000);
    const thumbPath = path.join(tempDir, "thumb.jpg");
    await extractThumbnail(filePath, thumbPath, thumbAt);
    await ctx.updateProgress(70);

    // 4. Upload original + thumbnail to S3.
    const itemId = nanoid(12);
    const ext = path.extname(filePath).slice(1) || "mp4";
    const videoKey = originalKey(payload.userId, itemId, ext);
    const thumbKey = `${videoKey}.thumb.jpg`;

    await uploadStream({
      key: videoKey,
      body: fs.createReadStream(filePath),
      contentType: guessContentType(ext),
    });
    await uploadStream({
      key: thumbKey,
      body: fs.createReadStream(thumbPath),
      contentType: "image/jpeg",
    });
    await ctx.updateProgress(85);

    // 5. Read raw yt-dlp metadata for the Item.metadata blob.
    let rawInfo: Record<string, unknown> | undefined;
    try {
      const text = await fs.promises.readFile(infoJsonPath, "utf8");
      rawInfo = JSON.parse(text) as Record<string, unknown>;
    } catch (err: unknown) {
      log.warn(
        { err },
        "Failed to read yt-dlp info.json; proceeding without raw metadata",
      );
    }

    // Stat the source for the canonical fileSize (probe.format.size is
    // sometimes absent on certain containers).
    const stat = await fs.promises.stat(filePath);

    // 6. Persist Item + root Version.
    await connectDB();

    await Item.create({
      itemId,
      userId: payload.userId,
      sourceUrl: payload.sourceUrl,
      sourcePlatform: "instagram",
      s3Key: videoKey,
      thumbnailKey: thumbKey,
      durationMs: meta.durationMs,
      width: meta.width,
      height: meta.height,
      videoCodec: meta.videoCodec,
      audioCodec: meta.audioCodec,
      videoBitrate: meta.videoBitrate,
      audioBitrate: meta.audioBitrate,
      framerate: meta.framerate,
      fileSizeBytes: stat.size,
      metadata: rawInfo,
    });

    const versionId = nanoid(12);
    await Version.create({
      versionId,
      userId: payload.userId,
      itemId,
      parentVersionId: null,
      label: "Original",
      s3Key: videoKey,
      durationMs: meta.durationMs,
      derivedFrom: { op: "original", params: {} },
      width: meta.width,
      height: meta.height,
      videoCodec: meta.videoCodec,
      audioCodec: meta.audioCodec,
      fileSizeBytes: stat.size,
    });

    ctx.setResult({ itemId, versionId });
    await ctx.updateProgress(95);
    log.info({ itemId, versionId }, "Ingest complete");
  } finally {
    await cleanupTempDir(tempDir);
  }
};

import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { connectDB } from "@/lib/db";
import { Version, type VersionDoc } from "@/lib/db/models";
import { cleanupTempDir, ensureTempDir } from "@/lib/ingest/paths";
import {
  classifyOp,
  defaultLabelFor,
} from "@/lib/jobs/executors/render-classify";
import type { JobExecutor, RenderJobPayload } from "@/lib/jobs/types";
import { requireEnv } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { child } from "@/lib/server/logger";
import { versionKey } from "@/lib/storage/keys";
import { downloadObjectToFile, uploadStream } from "@/lib/storage/s3";
import { concatVideos } from "@/lib/video/concat";
import { probeVideo } from "@/lib/video/probe";
import { trimClip } from "@/lib/video/trim";

/**
 * Render executor pipeline:
 *
 *   1. Resolve every unique source `Version` referenced in the spec and
 *      stream its S3 object to a per-job temp dir.
 *   2. Trim each clip out of its (already-downloaded) source via stream-
 *      copy ffmpeg.
 *   3. Concat the trimmed clips into the final output. Single-clip specs
 *      skip concat entirely (the trim output IS the final).
 *   4. Probe the result, upload to `versions/{userId}/{itemId}/...`, and
 *      persist a new `Version` doc.
 *   5. setResult({ versionId, itemId }) so the runner exposes it via
 *      `/api/jobs/[id]`.
 *
 * Backing-service env vars are asserted up-front so a misconfigured
 * environment fails with one clear error rather than partial work.
 */
export const renderExecutor: JobExecutor = async (ctx) => {
  // Narrow the loose payload back to its discriminated form.
  const payload = ctx.job.payload as RenderJobPayload;
  const log = child({
    jobId: ctx.job.id,
    userId: payload.userId,
    itemId: payload.itemId,
    baseVersionId: payload.baseVersionId,
    clipCount: payload.clips.length,
  });

  requireEnv(
    "MONGODB_URI",
    "MONGODB_DB_NAME",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "S3_BUCKET",
  );
  await connectDB();

  const tempDir = await ensureTempDir(ctx.job.id);

  try {
    await ctx.updateProgress(2);

    // 1. Resolve unique source versions and download each from S3.
    const uniqueVersionIds = Array.from(
      new Set(payload.clips.map((c) => c.sourceVersionId)),
    );
    const sourcePaths = new Map<string, string>();

    for (let i = 0; i < uniqueVersionIds.length; i++) {
      const vid = uniqueVersionIds[i];
      const v = await Version.findOne({
        versionId: vid,
        userId: payload.userId,
        itemId: payload.itemId,
      }).lean<VersionDoc>();
      if (!v) {
        throw new AppError(
          "VERSION_NOT_FOUND",
          `Source version ${vid} not found.`,
          404,
        );
      }
      const ext = path.extname(v.s3Key).slice(1) || "mp4";
      const dest = path.join(tempDir, `src-${i}-${vid}.${ext}`);
      log.info({ versionId: vid, s3Key: v.s3Key, dest }, "Downloading source");
      await downloadObjectToFile(v.s3Key, dest);
      sourcePaths.set(vid, dest);
      await ctx.updateProgress(
        2 + Math.floor(((i + 1) / uniqueVersionIds.length) * 38),
      );
    }

    // 2. Trim each clip into its own temp file.
    const clipPaths: string[] = [];
    for (let i = 0; i < payload.clips.length; i++) {
      const clip = payload.clips[i];
      const src = sourcePaths.get(clip.sourceVersionId);
      if (!src) {
        // Should not happen — uniqueVersionIds covers every clip.
        throw new Error(
          `Internal error: missing downloaded source for ${clip.sourceVersionId}.`,
        );
      }
      const out = path.join(tempDir, `clip-${i}.mp4`);
      log.info(
        {
          clipIndex: i,
          sourceVersionId: clip.sourceVersionId,
          startMs: clip.startMs,
          endMs: clip.endMs,
        },
        "Trimming clip",
      );
      await trimClip({
        input: src,
        output: out,
        startMs: clip.startMs,
        endMs: clip.endMs,
      });
      clipPaths.push(out);
      await ctx.updateProgress(
        40 + Math.floor(((i + 1) / payload.clips.length) * 25),
      );
    }

    // 3. Concat (or single-clip pass-through).
    const finalPath = path.join(tempDir, "final.mp4");
    if (clipPaths.length === 1) {
      // The trim output IS the final; just rename to keep the path stable.
      await fs.promises.rename(clipPaths[0], finalPath);
    } else {
      log.info({ inputs: clipPaths.length }, "Concat clips");
      await concatVideos({ inputs: clipPaths, output: finalPath });
    }
    await ctx.updateProgress(80);

    // 4. Probe the result + upload.
    const meta = await probeVideo(finalPath);
    const versionId = nanoid(12);
    const ext = path.extname(finalPath).slice(1) || "mp4";
    const key = versionKey(payload.userId, payload.itemId, versionId, ext);
    const stat = await fs.promises.stat(finalPath);
    log.info({ versionId, key, sizeBytes: stat.size }, "Uploading rendered version");
    await uploadStream({
      key,
      body: fs.createReadStream(finalPath),
      contentType: "video/mp4",
    });
    await ctx.updateProgress(92);

    // 5. Persist Version doc.
    const op = classifyOp(payload);
    await Version.create({
      versionId,
      userId: payload.userId,
      itemId: payload.itemId,
      parentVersionId: payload.baseVersionId,
      label: payload.label || defaultLabelFor(op, payload),
      s3Key: key,
      durationMs: meta.durationMs,
      derivedFrom: { op, params: { clips: payload.clips } },
      width: meta.width,
      height: meta.height,
      videoCodec: meta.videoCodec,
      audioCodec: meta.audioCodec,
      fileSizeBytes: stat.size,
    });

    ctx.setResult({ versionId, itemId: payload.itemId });
    await ctx.updateProgress(95);
    log.info({ versionId, op }, "Render complete");
  } finally {
    await cleanupTempDir(tempDir);
  }
};

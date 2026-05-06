import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { connectDB } from "@/lib/db";
import {
  AudioAsset,
  type AudioAssetDoc,
  Version,
  type VersionDoc,
} from "@/lib/db/models";
import { cleanupTempDir, ensureTempDir } from "@/lib/ingest/paths";
import type { AudioSwapJobPayload, JobExecutor } from "@/lib/jobs/types";
import { requireEnv } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { child } from "@/lib/server/logger";
import { versionKey } from "@/lib/storage/keys";
import { downloadObjectToFile, uploadStream } from "@/lib/storage/s3";
import { swapAudio } from "@/lib/video/audio-swap";
import { probeVideo } from "@/lib/video/probe";

/**
 * Audio-swap executor. Pipeline:
 *
 *   1. Resolve source Version + AudioAsset (ownership + same item).
 *   2. Stream-download both to a temp dir.
 *   3. Run `swapAudio` (copy first, audio re-encode fallback if container
 *      can't take the audio codec).
 *   4. Probe the result and upload to `versions/{userId}/{itemId}/...`.
 *   5. Persist a new Version with `op: 'audio-swap'` whose
 *      `parentVersionId` is the source Version. setResult.
 */
export const audioSwapExecutor: JobExecutor = async (ctx) => {
  const payload = ctx.job.payload as AudioSwapJobPayload;
  const log = child({
    jobId: ctx.job.id,
    userId: payload.userId,
    itemId: payload.itemId,
    versionId: payload.versionId,
    audioAssetId: payload.audioAssetId,
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
    await ctx.updateProgress(5);

    // 1. Resolve source Version + AudioAsset.
    const [v, a] = await Promise.all([
      Version.findOne({
        versionId: payload.versionId,
        userId: payload.userId,
        itemId: payload.itemId,
      }).lean<VersionDoc>(),
      AudioAsset.findOne({
        assetId: payload.audioAssetId,
        userId: payload.userId,
        itemId: payload.itemId,
      }).lean<AudioAssetDoc>(),
    ]);
    if (!v) {
      throw new AppError(
        "VERSION_NOT_FOUND",
        `Source version ${payload.versionId} not found.`,
        404,
      );
    }
    if (!a) {
      throw new AppError(
        "AUDIO_NOT_FOUND",
        `Audio asset ${payload.audioAssetId} not found.`,
        404,
      );
    }

    // 2. Download both.
    const videoExt = path.extname(v.s3Key).slice(1) || "mp4";
    const audioExt = path.extname(a.s3Key).slice(1) || a.format;
    const videoPath = path.join(tempDir, `video.${videoExt}`);
    const audioPath = path.join(tempDir, `audio.${audioExt}`);
    log.info({ videoKey: v.s3Key, audioKey: a.s3Key }, "Downloading inputs");
    await Promise.all([
      downloadObjectToFile(v.s3Key, videoPath),
      downloadObjectToFile(a.s3Key, audioPath),
    ]);
    await ctx.updateProgress(45);

    // 3. Swap.
    const finalPath = path.join(tempDir, "final.mp4");
    log.info({ videoPath, audioPath }, "Running audio swap");
    await swapAudio({
      videoInput: videoPath,
      audioInput: audioPath,
      output: finalPath,
    });
    await ctx.updateProgress(70);

    // 4. Probe + upload.
    const meta = await probeVideo(finalPath);
    const versionId = nanoid(12);
    const key = versionKey(payload.userId, payload.itemId, versionId, "mp4");
    const stat = await fs.promises.stat(finalPath);
    log.info({ versionId, key, sizeBytes: stat.size }, "Uploading swapped version");
    await uploadStream({
      key,
      body: fs.createReadStream(finalPath),
      contentType: "video/mp4",
    });
    await ctx.updateProgress(88);

    // 5. Persist Version.
    await Version.create({
      versionId,
      userId: payload.userId,
      itemId: payload.itemId,
      parentVersionId: payload.versionId,
      label: payload.label || `Audio swap (${a.label || a.assetId})`,
      s3Key: key,
      durationMs: meta.durationMs,
      derivedFrom: {
        op: "audio-swap",
        params: {
          sourceVersionId: payload.versionId,
          audioAssetId: payload.audioAssetId,
        },
      },
      width: meta.width,
      height: meta.height,
      videoCodec: meta.videoCodec,
      audioCodec: meta.audioCodec,
      fileSizeBytes: stat.size,
    });

    ctx.setResult({ versionId, itemId: payload.itemId });
    await ctx.updateProgress(95);
    log.info({ versionId }, "Audio swap complete");
  } finally {
    await cleanupTempDir(tempDir);
  }
};

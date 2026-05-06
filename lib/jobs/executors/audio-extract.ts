import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { connectDB } from "@/lib/db";
import {
  AUDIO_FORMATS,
  AudioAsset,
  type AudioFormat,
  Version,
  type VersionDoc,
} from "@/lib/db/models";
import { cleanupTempDir, ensureTempDir } from "@/lib/ingest/paths";
import type { AudioExtractJobPayload, JobExecutor } from "@/lib/jobs/types";
import { requireEnv } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { child } from "@/lib/server/logger";
import { audioKey } from "@/lib/storage/keys";
import { downloadObjectToFile, uploadStream } from "@/lib/storage/s3";
import { extractAudio } from "@/lib/video/audio-extract";
import { probeAudio } from "@/lib/video/audio-probe";

/**
 * Extension → AudioFormat mapping for AudioAsset.format. Keep in sync with
 * `extractAudio`'s output extensions and the Mongoose enum.
 */
function formatForExtension(ext: string): AudioFormat {
  const lower = ext.toLowerCase() as AudioFormat;
  if ((AUDIO_FORMATS as readonly string[]).includes(lower)) {
    return lower;
  }
  // Defensive fallback — should never hit because extractAudio only
  // returns one of the AUDIO_FORMATS members.
  return "mp3";
}

function contentTypeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "flac":
      return "audio/flac";
    default:
      return "application/octet-stream";
  }
}

/**
 * Audio-extract executor. Pipeline:
 *
 *   1. Resolve the source Version and stream-download it to a temp file.
 *   2. Run `extractAudio` (stream-copy first, mp3 fallback if codec/
 *      container won't fit).
 *   3. Probe the produced audio for duration / sample rate / channels.
 *   4. Upload the asset under `audio/{userId}/{itemId}/{assetId}.{ext}`.
 *   5. Persist an `AudioAsset` doc and `setResult({ assetId, itemId })`.
 */
export const audioExtractExecutor: JobExecutor = async (ctx) => {
  const payload = ctx.job.payload as AudioExtractJobPayload;
  const log = child({
    jobId: ctx.job.id,
    userId: payload.userId,
    itemId: payload.itemId,
    versionId: payload.versionId,
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

    // 1. Resolve source Version + download.
    const v = await Version.findOne({
      versionId: payload.versionId,
      userId: payload.userId,
      itemId: payload.itemId,
    }).lean<VersionDoc>();
    if (!v) {
      throw new AppError(
        "VERSION_NOT_FOUND",
        `Source version ${payload.versionId} not found.`,
        404,
      );
    }

    const srcExt = path.extname(v.s3Key).slice(1) || "mp4";
    const srcPath = path.join(tempDir, `src.${srcExt}`);
    log.info({ s3Key: v.s3Key, dest: srcPath }, "Downloading source video");
    await downloadObjectToFile(v.s3Key, srcPath);
    await ctx.updateProgress(30);

    // 2. Extract audio (stream-copy, mp3 fallback).
    const assetId = nanoid(12);
    const outBase = path.join(tempDir, `audio-${assetId}`);
    const result = await extractAudio({
      input: srcPath,
      outputBase: outBase,
      sourceCodecHint: v.audioCodec,
    });
    log.info(
      { format: result.format, reencoded: result.reencoded },
      "Audio extraction complete",
    );
    await ctx.updateProgress(50);

    // 3. Probe the produced audio for duration / sample rate / channels.
    const probeMeta = await probeAudio(result.outputPath);
    await ctx.updateProgress(70);

    // 4. Upload.
    const stat = await fs.promises.stat(result.outputPath);
    const key = audioKey(payload.userId, payload.itemId, assetId, result.format);
    log.info({ key, sizeBytes: stat.size }, "Uploading audio asset");
    await uploadStream({
      key,
      body: fs.createReadStream(result.outputPath),
      contentType: contentTypeFor(result.format),
    });
    await ctx.updateProgress(85);

    // 5. Persist AudioAsset.
    await AudioAsset.create({
      assetId,
      userId: payload.userId,
      itemId: payload.itemId,
      sourceVersionId: payload.versionId,
      s3Key: key,
      format: formatForExtension(result.format),
      durationMs: probeMeta.durationMs,
      sampleRate: probeMeta.sampleRate,
      channels: probeMeta.channels,
      fileSizeBytes: stat.size,
      label: payload.label,
    });

    ctx.setResult({ assetId, itemId: payload.itemId });
    await ctx.updateProgress(95);
    log.info({ assetId }, "Audio extract complete");
  } finally {
    await cleanupTempDir(tempDir);
  }
};


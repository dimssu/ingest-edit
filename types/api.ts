import { z } from "zod";

/**
 * Wire schemas + inferred TS types for every API route. Importing this from
 * route handlers gives us a single source of truth — and the schema doubles
 * as runtime input validation.
 */

// ---- /api/ingest -----------------------------------------------------------

export const IngestRequestBody = z.object({
  sourceUrl: z.string().url(),
});
export type IngestRequestBody = z.infer<typeof IngestRequestBody>;

export const IngestResponse = z.object({
  jobId: z.string(),
  state: z.literal("queued"),
});
export type IngestResponse = z.infer<typeof IngestResponse>;

// ---- /api/jobs/[jobId] -----------------------------------------------------

export const JobStateSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
]);
export type JobStateSchema = z.infer<typeof JobStateSchema>;

export const JobStatusResponse = z.object({
  jobId: z.string(),
  userId: z.string(),
  kind: z.string(),
  state: JobStateSchema,
  progress: z.number(),
  payload: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.object({ message: z.string() }).optional(),
  attempts: z.number(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  relatedItemId: z.string().optional(),
  relatedVersionId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type JobStatusResponse = z.infer<typeof JobStatusResponse>;

// ---- /api/items ------------------------------------------------------------

export const ItemSummary = z.object({
  itemId: z.string(),
  sourceUrl: z.string(),
  sourcePlatform: z.string(),
  thumbnailUrl: z.string().optional(),
  durationMs: z.number(),
  width: z.number(),
  height: z.number(),
  createdAt: z.string(),
});
export type ItemSummary = z.infer<typeof ItemSummary>;

export const ItemListResponse = z.object({
  items: z.array(ItemSummary),
  nextCursor: z.string().optional(),
});
export type ItemListResponse = z.infer<typeof ItemListResponse>;

// ---- /api/items/[itemId] ---------------------------------------------------

export const ItemDetail = z.object({
  itemId: z.string(),
  sourceUrl: z.string(),
  sourcePlatform: z.string(),
  videoUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  durationMs: z.number(),
  width: z.number(),
  height: z.number(),
  videoCodec: z.string(),
  audioCodec: z.string().optional(),
  videoBitrate: z.number().optional(),
  audioBitrate: z.number().optional(),
  framerate: z.number().optional(),
  fileSizeBytes: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ItemDetail = z.infer<typeof ItemDetail>;

export const VersionSummary = z.object({
  versionId: z.string(),
  itemId: z.string(),
  parentVersionId: z.string().nullable(),
  label: z.string(),
  videoUrl: z.string().optional(),
  durationMs: z.number(),
  derivedFrom: z.object({
    op: z.string(),
    params: z.record(z.string(), z.unknown()),
  }),
  width: z.number().optional(),
  height: z.number().optional(),
  videoCodec: z.string().optional(),
  audioCodec: z.string().optional(),
  fileSizeBytes: z.number().optional(),
  createdAt: z.string(),
});
export type VersionSummary = z.infer<typeof VersionSummary>;

export const AudioAssetSummary = z.object({
  assetId: z.string(),
  itemId: z.string(),
  sourceVersionId: z.string().optional(),
  audioUrl: z.string().optional(),
  format: z.string(),
  durationMs: z.number(),
  sampleRate: z.number().optional(),
  channels: z.number().optional(),
  fileSizeBytes: z.number().optional(),
  label: z.string().optional(),
  createdAt: z.string(),
});
export type AudioAssetSummary = z.infer<typeof AudioAssetSummary>;

export const ItemDetailResponse = z.object({
  item: ItemDetail,
  versions: z.array(VersionSummary),
  audioAssets: z.array(AudioAssetSummary),
});
export type ItemDetailResponse = z.infer<typeof ItemDetailResponse>;

// ---- /api/render -----------------------------------------------------------

export const RenderRequestClip = z.object({
  sourceVersionId: z.string().min(1),
  startMs: z.number().finite().nonnegative(),
  endMs: z.number().finite().positive(),
});
export type RenderRequestClip = z.infer<typeof RenderRequestClip>;

export const RenderRequest = z.object({
  itemId: z.string().min(1),
  baseVersionId: z.string().min(1),
  label: z.string().min(1).max(200).optional(),
  clips: z.array(RenderRequestClip).min(1, "At least one clip is required."),
});
export type RenderRequest = z.infer<typeof RenderRequest>;

// ---- /api/audio/extract ----------------------------------------------------

export const AudioExtractRequest = z.object({
  itemId: z.string().min(1),
  versionId: z.string().min(1),
  label: z.string().min(1).max(200).optional(),
});
export type AudioExtractRequest = z.infer<typeof AudioExtractRequest>;

// ---- /api/audio/swap -------------------------------------------------------

export const AudioSwapRequest = z.object({
  itemId: z.string().min(1),
  versionId: z.string().min(1),
  audioAssetId: z.string().min(1),
  label: z.string().min(1).max(200).optional(),
});
export type AudioSwapRequest = z.infer<typeof AudioSwapRequest>;

// ---- shared "job enqueued" response ---------------------------------------

export const EnqueueJobResponse = z.object({
  jobId: z.string(),
  state: z.literal("queued"),
});
export type EnqueueJobResponse = z.infer<typeof EnqueueJobResponse>;

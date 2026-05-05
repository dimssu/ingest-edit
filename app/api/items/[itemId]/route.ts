import {
  AudioAsset,
  type AudioAssetDoc,
  Item,
  type ItemDoc,
  Version,
  type VersionDoc,
} from "@/lib/db/models";
import { bootServer } from "@/lib/server/bootstrap";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { child } from "@/lib/server/logger";
import { getSignedReadUrl } from "@/lib/storage/s3";
import {
  type AudioAssetSummary,
  type ItemDetailResponse,
  type VersionSummary,
} from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = child({ route: "items.detail" });

async function safeSignedUrl(key: string | undefined): Promise<string | undefined> {
  if (!key) return undefined;
  try {
    return await getSignedReadUrl(key);
  } catch (err: unknown) {
    log.warn({ err, key }, "Failed to presign S3 read URL");
    return undefined;
  }
}

/**
 * GET /api/items/[itemId]
 *
 * Returns the item, every Version belonging to it, and every AudioAsset
 * attached. Resolves presigned URLs for video/thumb/audio so the client
 * can stream directly. 404s if the item is missing or owned by another
 * user (single-tenant: APP_USER_ID).
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ itemId: string }> },
): Promise<Response> {
  try {
    await bootServer();
    const { itemId } = await ctx.params;
    const userId = env.APP_USER_ID;

    const item = await Item.findOne({ itemId }).lean<ItemDoc>();
    if (!item || item.userId !== userId) {
      throw new AppError(
        "ITEM_NOT_FOUND",
        `No item with id ${itemId}.`,
        404,
      );
    }

    const [versions, audioAssets] = await Promise.all([
      Version.find({ itemId, userId })
        .sort({ createdAt: 1 })
        .lean<VersionDoc[]>(),
      AudioAsset.find({ itemId, userId })
        .sort({ createdAt: 1 })
        .lean<AudioAssetDoc[]>(),
    ]);

    const [videoUrl, thumbnailUrl] = await Promise.all([
      safeSignedUrl(item.s3Key),
      safeSignedUrl(item.thumbnailKey),
    ]);

    const versionSummaries: VersionSummary[] = await Promise.all(
      versions.map(async (v) => ({
        versionId: v.versionId,
        itemId: v.itemId,
        parentVersionId: v.parentVersionId,
        label: v.label,
        videoUrl: await safeSignedUrl(v.s3Key),
        durationMs: v.durationMs,
        derivedFrom: v.derivedFrom,
        width: v.width,
        height: v.height,
        videoCodec: v.videoCodec,
        audioCodec: v.audioCodec,
        fileSizeBytes: v.fileSizeBytes,
        createdAt: v.createdAt.toISOString(),
      })),
    );

    const audioSummaries: AudioAssetSummary[] = await Promise.all(
      audioAssets.map(async (a) => ({
        assetId: a.assetId,
        itemId: a.itemId,
        sourceVersionId: a.sourceVersionId,
        audioUrl: await safeSignedUrl(a.s3Key),
        format: a.format,
        durationMs: a.durationMs,
        sampleRate: a.sampleRate,
        channels: a.channels,
        fileSizeBytes: a.fileSizeBytes,
        label: a.label,
        createdAt: a.createdAt.toISOString(),
      })),
    );

    const body: ItemDetailResponse = {
      item: {
        itemId: item.itemId,
        sourceUrl: item.sourceUrl,
        sourcePlatform: item.sourcePlatform,
        videoUrl,
        thumbnailUrl,
        durationMs: item.durationMs,
        width: item.width,
        height: item.height,
        videoCodec: item.videoCodec,
        audioCodec: item.audioCodec,
        videoBitrate: item.videoBitrate,
        audioBitrate: item.audioBitrate,
        framerate: item.framerate,
        fileSizeBytes: item.fileSizeBytes,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
      versions: versionSummaries,
      audioAssets: audioSummaries,
    };
    return jsonResponse(body);
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

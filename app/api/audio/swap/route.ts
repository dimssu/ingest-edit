import { nanoid } from "nanoid";
import { AudioAsset, Item, Version } from "@/lib/db/models";
import { enqueueJob } from "@/lib/jobs/runner";
import { getExecutor } from "@/lib/jobs/registry";
import { bootServer } from "@/lib/server/bootstrap";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { child } from "@/lib/server/logger";
import {
  AudioSwapRequest,
  type EnqueueJobResponse,
} from "@/types/api";
import type { JobId, UserId } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/audio/swap
 *
 * Validates `{ itemId, versionId, audioAssetId }`, verifies all three
 * belong to the same user + item, persists a queued audio-swap job, and
 * returns the `jobId` (202). The executor produces a new Version whose
 * `parentVersionId` is the source video version.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new AppError("BAD_JSON", "Request body must be valid JSON.", 400);
    }

    const parsed = AudioSwapRequest.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        "BAD_REQUEST",
        "Invalid audio-swap request body.",
        400,
        { issues: parsed.error.issues },
      );
    }
    const body = parsed.data;

    await bootServer();
    const userId = env.APP_USER_ID as UserId;

    const [item, version, asset] = await Promise.all([
      Item.findOne({ itemId: body.itemId, userId }).lean().exec(),
      Version.findOne({
        versionId: body.versionId,
        userId,
        itemId: body.itemId,
      })
        .lean()
        .exec(),
      AudioAsset.findOne({
        assetId: body.audioAssetId,
        userId,
        itemId: body.itemId,
      })
        .lean()
        .exec(),
    ]);
    if (!item) {
      throw new AppError(
        "ITEM_NOT_FOUND",
        `Item ${body.itemId} not found.`,
        404,
      );
    }
    if (!version) {
      throw new AppError(
        "VERSION_NOT_FOUND",
        `Version ${body.versionId} not found on item ${body.itemId}.`,
        404,
      );
    }
    if (!asset) {
      throw new AppError(
        "AUDIO_NOT_FOUND",
        `Audio asset ${body.audioAssetId} not found on item ${body.itemId}.`,
        404,
      );
    }

    const jobId = nanoid(12) as JobId;
    const log = child({
      jobId,
      userId,
      itemId: body.itemId,
      versionId: body.versionId,
      audioAssetId: body.audioAssetId,
    });
    log.info("Enqueueing audio-swap job");

    void enqueueJob({
      jobId,
      kind: "audio-swap",
      userId,
      payload: {
        kind: "audio-swap",
        userId,
        itemId: body.itemId,
        versionId: body.versionId,
        audioAssetId: body.audioAssetId,
        label: body.label,
      },
      executor: getExecutor("audio-swap"),
      relatedItemId: body.itemId,
      relatedVersionId: body.versionId,
    }).catch((err: unknown) => {
      log.error({ err }, "Background audio-swap job rejected");
    });

    const responseBody: EnqueueJobResponse = { jobId, state: "queued" };
    return jsonResponse(responseBody, 202);
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

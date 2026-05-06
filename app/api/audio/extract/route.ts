import { nanoid } from "nanoid";
import { Item, Version } from "@/lib/db/models";
import { enqueueJob } from "@/lib/jobs/runner";
import { getExecutor } from "@/lib/jobs/registry";
import { bootServer } from "@/lib/server/bootstrap";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { child } from "@/lib/server/logger";
import {
  AudioExtractRequest,
  type EnqueueJobResponse,
} from "@/types/api";
import type { JobId, UserId } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/audio/extract
 *
 * Validates `{ itemId, versionId }`, verifies ownership of both, persists a
 * queued audio-extract job, schedules the executor, and returns the
 * `jobId` (202). The executor produces a new AudioAsset whose
 * `sourceVersionId` is the input version.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new AppError("BAD_JSON", "Request body must be valid JSON.", 400);
    }

    const parsed = AudioExtractRequest.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        "BAD_REQUEST",
        "Invalid audio-extract request body.",
        400,
        { issues: parsed.error.issues },
      );
    }
    const body = parsed.data;

    await bootServer();
    const userId = env.APP_USER_ID as UserId;

    // Cheap ownership check — both must exist and belong to the user.
    const [item, version] = await Promise.all([
      Item.findOne({ itemId: body.itemId, userId }).lean().exec(),
      Version.findOne({
        versionId: body.versionId,
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

    const jobId = nanoid(12) as JobId;
    const log = child({
      jobId,
      userId,
      itemId: body.itemId,
      versionId: body.versionId,
    });
    log.info("Enqueueing audio-extract job");

    void enqueueJob({
      jobId,
      kind: "audio-extract",
      userId,
      payload: {
        kind: "audio-extract",
        userId,
        itemId: body.itemId,
        versionId: body.versionId,
        label: body.label,
      },
      executor: getExecutor("audio-extract"),
      relatedItemId: body.itemId,
      relatedVersionId: body.versionId,
    }).catch((err: unknown) => {
      log.error({ err }, "Background audio-extract job rejected");
    });

    const responseBody: EnqueueJobResponse = { jobId, state: "queued" };
    return jsonResponse(responseBody, 202);
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

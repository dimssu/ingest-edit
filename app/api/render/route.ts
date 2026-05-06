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
  type EnqueueJobResponse,
  RenderRequest,
} from "@/types/api";
import type { JobId, UserId } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/render
 *
 * Validates the edit spec, sanity-checks the referenced Item + Versions for
 * ownership, persists a queued render job, schedules the executor on the
 * in-process queue, and returns the `jobId` immediately (202). The client
 * polls /api/jobs/[jobId] for state.
 *
 * As with `/api/ingest`, validation runs BEFORE bootServer so a malformed
 * payload returns a crisp 400 even when backing services are unconfigured.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new AppError("BAD_JSON", "Request body must be valid JSON.", 400);
    }

    const parsed = RenderRequest.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        "BAD_REQUEST",
        "Invalid render request body.",
        400,
        { issues: parsed.error.issues },
      );
    }
    const body = parsed.data;

    // Tighter invariants the schema doesn't fully cover: every clip must
    // have endMs strictly greater than startMs.
    for (const [i, clip] of body.clips.entries()) {
      if (clip.endMs <= clip.startMs) {
        throw new AppError(
          "BAD_REQUEST",
          `Clip ${i} has empty or inverted range (startMs=${clip.startMs}, endMs=${clip.endMs}).`,
          400,
        );
      }
    }

    // Inputs OK — boot Mongo + queue.
    await bootServer();

    const userId = env.APP_USER_ID as UserId;

    // Verify Item exists + belongs to user.
    const item = await Item.findOne({ itemId: body.itemId, userId })
      .lean()
      .exec();
    if (!item) {
      throw new AppError(
        "ITEM_NOT_FOUND",
        `Item ${body.itemId} not found.`,
        404,
      );
    }

    // Verify the base version + every referenced source version belong to
    // the same item + user. We do a single query for the union of ids.
    const referencedIds = Array.from(
      new Set([
        body.baseVersionId,
        ...body.clips.map((c) => c.sourceVersionId),
      ]),
    );
    const versions = await Version.find({
      versionId: { $in: referencedIds },
      userId,
      itemId: body.itemId,
    })
      .lean()
      .exec();
    const foundIds = new Set(versions.map((v) => v.versionId));
    const missing = referencedIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new AppError(
        "VERSION_NOT_FOUND",
        `Referenced versions not found: ${missing.join(", ")}.`,
        404,
        { missing },
      );
    }

    const jobId = nanoid(12) as JobId;
    const log = child({ jobId, userId, itemId: body.itemId });
    log.info(
      { clipCount: body.clips.length, baseVersionId: body.baseVersionId },
      "Enqueueing render job",
    );

    void enqueueJob({
      jobId,
      kind: "render",
      userId,
      payload: {
        kind: "render",
        userId,
        itemId: body.itemId,
        baseVersionId: body.baseVersionId,
        clips: body.clips,
        label: body.label,
      },
      executor: getExecutor("render"),
      relatedItemId: body.itemId,
    }).catch((err: unknown) => {
      log.error({ err }, "Background render job rejected");
    });

    const responseBody: EnqueueJobResponse = { jobId, state: "queued" };
    return jsonResponse(responseBody, 202);
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

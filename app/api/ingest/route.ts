import { nanoid } from "nanoid";
import { validateInstagramUrl } from "@/lib/ingest/instagram";
import { enqueueJob } from "@/lib/jobs/runner";
import { getExecutor } from "@/lib/jobs/registry";
import { bootServer } from "@/lib/server/bootstrap";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { child } from "@/lib/server/logger";
import { IngestRequestBody, type IngestResponse } from "@/types/api";
import type { JobId, UserId } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ingest
 *
 * Validates `{ sourceUrl }`, performs the Instagram SSRF guard, persists a
 * queued ingest job, kicks off the in-process executor, and returns the
 * `jobId` immediately (202). The executor runs in background; the client
 * polls /api/jobs/[jobId] for state.
 *
 * Note: enqueueJob's returned promise resolves on executor completion, so
 * we deliberately do NOT await it — that would block the request handler
 * for the entire ingest. We schedule the work and return.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // Validate inputs BEFORE any boot-time side effects (DB connect, queue
    // init). This way a malformed URL never wakes Mongo/S3 and returns a
    // crisp 400 even when backing services are unconfigured.
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new AppError("BAD_JSON", "Request body must be valid JSON.", 400);
    }

    const parsed = IngestRequestBody.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        "BAD_REQUEST",
        "Invalid request body.",
        400,
        { issues: parsed.error.issues },
      );
    }

    const validation = validateInstagramUrl(parsed.data.sourceUrl);
    if (!validation.ok) {
      throw new AppError(
        "INVALID_INSTAGRAM_URL",
        `Rejected source URL: ${validation.reason}.`,
        400,
        { reason: validation.reason },
      );
    }

    // Inputs OK — now bring up the server (Mongo + queue) and enqueue.
    await bootServer();

    const jobId = nanoid(12) as JobId;
    const userId = env.APP_USER_ID as UserId;
    const log = child({ jobId, userId });

    log.info({ sourceUrl: validation.url }, "Enqueueing ingest job");

    // Fire-and-forget: enqueueJob's promise resolves only when the executor
    // finishes. We attach a catch so the unhandled rejection doesn't leak.
    void enqueueJob({
      jobId,
      kind: "ingest",
      userId,
      payload: {
        kind: "ingest",
        sourceUrl: validation.url,
        userId,
      },
      executor: getExecutor("ingest"),
    }).catch((err: unknown) => {
      log.error({ err }, "Background ingest job rejected");
    });

    const body: IngestResponse = { jobId, state: "queued" };
    return jsonResponse(body, 202);
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

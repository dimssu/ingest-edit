import { getJob } from "@/lib/jobs/runner";
import { toPublicJob } from "@/lib/jobs/public";
import { bootServer } from "@/lib/server/bootstrap";
import { AppError } from "@/lib/server/errors";
import { errorResponse, jsonResponse } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/[jobId]
 *
 * Returns the public projection of a job doc. 404 if not found.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  try {
    await bootServer();
    const { jobId } = await ctx.params;
    const doc = await getJob(jobId);
    if (!doc) {
      throw new AppError("JOB_NOT_FOUND", `No job with id ${jobId}.`, 404);
    }
    return jsonResponse(toPublicJob(doc));
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

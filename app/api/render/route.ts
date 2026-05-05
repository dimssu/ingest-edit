import { errorResponse, jsonResponse } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/render
 *
 * Phase 6 stub: the editor UI assembles an edit spec end-to-end and POSTs
 * it here so reviewers can verify the wire payload. The actual ffmpeg-driven
 * executor lands in Phase 7. Until then, we echo the body back inside an
 * `accepted` field and respond 501 with a stable error code so the client
 * can show a calm "wired but not yet executing" affordance.
 *
 * We deliberately do NOT bring up the server (no DB connect, no queue) — a
 * stub that wakes Mongo would muddy the smoke-test signal.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    let raw: unknown = null;
    try {
      raw = await request.json();
    } catch {
      // Tolerate empty/non-JSON bodies — the message is the same either way.
      raw = null;
    }

    const body = {
      error: {
        code: "RENDER_NOT_IMPLEMENTED",
        message:
          "Render is implemented in a later phase. Spec accepted but no executor wired yet.",
      },
      accepted: raw,
    };
    return jsonResponse(body, 501);
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

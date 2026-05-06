import { nanoid } from "nanoid";
import { logger } from "@/lib/server/logger";
import { AppError, isAppError } from "@/lib/server/errors";

/**
 * Returns a JSON response with the given status code. A thin wrapper around
 * `Response.json` so route handlers don't repeat the status plumbing.
 */
export function jsonResponse<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

/**
 * Maps any thrown value into a JSON error response.
 *
 *   - `AppError` instances surface their developer-friendly `{ code,
 *     message, details }`. These messages are intentional, surfaced text
 *     and are returned verbatim in every environment.
 *   - Anything else is logged server-side with a stable `requestId` so the
 *     full error (including stack) is reachable from logs. The body
 *     returned to the client is sanitized in production: only the request
 *     id is leaked. In non-production we keep echoing `err.message` so
 *     dev debugging stays easy.
 *
 * Every non-AppError response includes a `requestId` in the body so a user
 * can quote it when reporting an issue. The same id appears in the matching
 * server log line.
 */
export function errorResponse(err: unknown): Response {
  if (isAppError(err)) {
    const body: ErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };
    return jsonResponse(body, err.status);
  }

  // 12 chars keeps collisions vanishingly rare across realistic log windows.
  const requestId = nanoid(12);
  // Always log the full error server-side so the requestId in the response
  // body can be cross-referenced with stack + raw message in the log.
  logger.error(
    {
      requestId,
      err,
      stack: err instanceof Error ? err.stack : undefined,
    },
    "Unhandled route error",
  );

  const isProd = process.env.NODE_ENV === "production";
  const message = isProd
    ? `An internal error occurred. Reference: ${requestId}`
    : err instanceof Error
      ? err.message
      : String(err);

  const body: ErrorBody = {
    error: {
      code: "INTERNAL_ERROR",
      message,
      requestId,
    },
  };
  return jsonResponse(body, 500);
}

export { AppError };

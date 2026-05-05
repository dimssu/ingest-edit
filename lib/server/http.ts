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
  };
}

/**
 * Maps any thrown value into a JSON error response. `AppError`s carry their
 * own status + code; anything else is logged and surfaced as
 * `INTERNAL_ERROR` with a generic 500 so we never leak stack traces.
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

  logger.error({ err }, "Unhandled route error");
  const message = err instanceof Error ? err.message : String(err);
  const body: ErrorBody = {
    error: {
      code: "INTERNAL_ERROR",
      message,
    },
  };
  return jsonResponse(body, 500);
}

export { AppError };

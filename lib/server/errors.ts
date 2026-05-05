/**
 * Typed application errors for route handlers. Anything thrown as an
 * `AppError` is mapped to a clean JSON response by `errorResponse` in
 * `http.ts`; anything else is logged and surfaced as a generic 500.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

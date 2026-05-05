"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import type { ApiError } from "@/lib/client/api";

interface CanvasErrorProps {
  error: ApiError | Error;
  onRetry?: () => void;
}

function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  );
}

/**
 * Calm error surface for the canvas. 404s get a distinct treatment with a
 * clear path back to the dashboard; everything else gets a Retry button.
 */
export function CanvasError({ error, onRetry }: CanvasErrorProps) {
  const status = isApiError(error) ? error.status : undefined;
  const isNotFound = status === 404;

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-20 text-center"
    >
      <p className="text-base font-medium text-foreground">
        {isNotFound
          ? "We couldn’t find that item."
          : "Couldn’t load this item."}
      </p>
      {!isNotFound ? (
        <p className="max-w-sm text-sm text-muted-foreground">
          {error.message}
        </p>
      ) : (
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been deleted, or the link is incorrect.
        </p>
      )}
      <div className="pt-2">
        {isNotFound ? (
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to dashboard
          </Link>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onRetry?.();
            }}
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

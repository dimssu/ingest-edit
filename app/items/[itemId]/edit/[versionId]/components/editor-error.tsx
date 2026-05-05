"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import type { ApiError } from "@/lib/client/api";

interface EditorErrorProps {
  itemId: string;
  /** Pre-rendered headline / subline. Lets the page flag missing-version vs network. */
  kind: "missing-version" | "load-failed";
  error?: ApiError | Error;
  onRetry?: () => void;
}

/**
 * Calm error surface for the editor. Two modes:
 *   - `missing-version`: the route's versionId doesn't match anything on
 *     the item — give the user a path back to the canvas.
 *   - `load-failed`: the underlying item-detail fetch errored — offer a retry.
 */
export function EditorError({
  itemId,
  kind,
  error,
  onRetry,
}: EditorErrorProps) {
  const isMissing = kind === "missing-version";

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center"
    >
      <p className="text-base font-medium text-foreground">
        {isMissing
          ? "We couldn’t find that version."
          : "Couldn’t load the editor."}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {isMissing
          ? "The version may have been removed, or the link is incorrect."
          : (error?.message ?? "An unexpected error occurred.")}
      </p>
      <div className="pt-2">
        {isMissing ? (
          <Link
            href={`/items/${itemId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to canvas
          </Link>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRetry?.()}
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

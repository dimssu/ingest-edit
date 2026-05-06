"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useJob } from "@/app/dashboard/hooks/use-job";
import { cn } from "@/lib/utils";
import type { JobStatusResponse } from "@/types/api";

interface JobProgressPillProps {
  jobId: string;
  /** Short human label, e.g. "Swapping audio". */
  label: string;
  /** Fired exactly once when the job lands on `succeeded`. */
  onComplete?: (result: Record<string, unknown> | undefined) => void;
  /** Fired exactly once when the job lands on `failed`. */
  onError?: (message: string) => void;
  /** Optional: parent calls this after auto-dismiss so it can drop the pill
   *  from its tree. Independent of `onComplete` so the parent can react
   *  immediately to success while the pill keeps showing for ~3s. */
  onDismiss?: () => void;
  className?: string;
}

const STATE_LABELS: Record<JobStatusResponse["state"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
};

/**
 * Compact card that polls a single job and reports the terminal state via
 * callbacks. Mounted inline (action-panel, editor overlay) rather than as
 * a global toast so the affordance lives next to the action that started
 * it. Auto-dismisses ~3s after success; `failed` stays sticky until the
 * parent unmounts the pill.
 */
export function JobProgressPill({
  jobId,
  label,
  onComplete,
  onError,
  onDismiss,
  className,
}: JobProgressPillProps) {
  const { data, error } = useJob(jobId);
  const firedRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const state: JobStatusResponse["state"] = data?.state ?? "queued";
  // `progress` is on a 0–100 scale (set by both real executors and mocks).
  const percent = Math.max(0, Math.min(100, Math.round(data?.progress ?? 0)));
  const errorMessage =
    state === "failed"
      ? (data?.error?.message ?? "Job failed.")
      : error
        ? error.message
        : null;

  useEffect(() => {
    if (firedRef.current) return;
    if (!data) return;
    if (data.state === "succeeded") {
      firedRef.current = true;
      onComplete?.(data.result);
      // Auto-dismiss the pill after a brief acknowledgement.
      dismissTimerRef.current = setTimeout(() => {
        onDismiss?.();
      }, 3000);
    } else if (data.state === "failed") {
      firedRef.current = true;
      onError?.(data.error?.message ?? "Job failed.");
    }
  }, [data, onComplete, onError, onDismiss]);

  // Always clear the dismissal timer on unmount so an unmounted parent
  // doesn't get a phantom callback.
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "rounded-lg border border-border/60 bg-card/60 p-3 shadow-sm",
        state === "failed" && "border-destructive/40 bg-destructive/5",
        state === "succeeded" && "border-emerald-500/30 bg-emerald-500/5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {state === "succeeded" ? (
            <CheckCircle2
              className="size-3.5 shrink-0 text-emerald-500"
              aria-hidden
            />
          ) : state === "failed" ? (
            <XCircle
              className="size-3.5 shrink-0 text-destructive"
              aria-hidden
            />
          ) : (
            <Loader2
              className="size-3.5 shrink-0 animate-spin text-muted-foreground"
              aria-hidden
            />
          )}
          <p className="truncate text-sm font-medium text-foreground">
            {label}
          </p>
        </div>
        <Badge
          variant={
            state === "failed"
              ? "destructive"
              : state === "succeeded"
                ? "secondary"
                : "outline"
          }
          className="h-5 text-[10px] uppercase tracking-wide"
        >
          {STATE_LABELS[state]}
        </Badge>
      </div>

      {(state === "queued" || state === "running") && (
        <div className="mt-2.5 space-y-1">
          <Progress value={state === "queued" ? null : percent} />
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {state === "queued" ? "Waiting to start…" : `${percent}%`}
          </p>
        </div>
      )}

      {state === "failed" && errorMessage ? (
        <p className="mt-2 text-[11px] text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}

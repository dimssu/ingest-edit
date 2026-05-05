"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ExternalLink, X } from "lucide-react";
import { useSWRConfig } from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useJob } from "@/app/dashboard/hooks/use-job";
import { useJobsContext, type TrackedJob } from "@/app/dashboard/components/jobs-context";
import { ITEMS_KEY } from "@/app/dashboard/hooks/use-items";
import { hostnameOf, truncateMiddle } from "@/lib/client/format";
import type { JobStatusResponse } from "@/types/api";

interface JobCardProps {
  job: TrackedJob;
}

const STATE_LABELS: Record<JobStatusResponse["state"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
};

function StateBadge({ state }: { state: JobStatusResponse["state"] }) {
  if (state === "succeeded") {
    return (
      <Badge variant="secondary" className="text-foreground">
        {STATE_LABELS[state]}
      </Badge>
    );
  }
  if (state === "failed") {
    return <Badge variant="destructive">{STATE_LABELS[state]}</Badge>;
  }
  if (state === "running") {
    return <Badge variant="default">{STATE_LABELS[state]}</Badge>;
  }
  return <Badge variant="outline">{STATE_LABELS[state]}</Badge>;
}

export function JobCard({ job }: JobCardProps) {
  const { data, error } = useJob(job.jobId);
  const { dismissJob } = useJobsContext();
  const { mutate } = useSWRConfig();
  const refreshedRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When a job lands, refresh the items grid once so the new item appears.
  useEffect(() => {
    if (!data) return;
    if (data.state === "succeeded" && !refreshedRef.current) {
      refreshedRef.current = true;
      void mutate(ITEMS_KEY);
    }
  }, [data, mutate]);

  // Auto-dismiss successful jobs after a brief acknowledgement window so
  // the tray doesn't grow unbounded.
  useEffect(() => {
    if (!data || data.state !== "succeeded") return;
    if (dismissTimerRef.current !== null) return;
    dismissTimerRef.current = setTimeout(() => {
      dismissJob(job.jobId);
    }, 6000);
    return () => {
      if (dismissTimerRef.current !== null) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [data, job.jobId, dismissJob]);

  const state: JobStatusResponse["state"] = data?.state ?? "queued";
  const progress = data?.progress ?? 0;
  const percent = Math.round(progress * 100);
  const itemId =
    typeof data?.result?.itemId === "string"
      ? data.result.itemId
      : data?.relatedItemId;

  const errorMessage =
    state === "failed"
      ? data?.error?.message ?? "Something went wrong."
      : error
        ? error.message
        : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StateBadge state={state} />
            <span className="text-xs text-muted-foreground">
              {hostnameOf(job.sourceUrl)}
            </span>
          </div>
          <a
            href={job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline underline-offset-4"
          >
            <span className="truncate">{truncateMiddle(job.sourceUrl, 64)}</span>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </a>
        </div>

        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => dismissJob(job.jobId)}
          aria-label="Dismiss job"
        >
          <X aria-hidden />
        </Button>
      </div>

      {(state === "queued" || state === "running") && (
        <div className="mt-3 space-y-1.5">
          <Progress value={state === "queued" ? null : percent} />
          <p className="text-xs text-muted-foreground tabular-nums">
            {state === "queued" ? "Waiting to start…" : `${percent}%`}
          </p>
        </div>
      )}

      {state === "succeeded" && itemId ? (
        <div className="mt-3">
          <Link
            href={`/items/${itemId}`}
            className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View item
          </Link>
        </div>
      ) : null}

      {state === "failed" && errorMessage ? (
        <p className="mt-3 text-xs text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}

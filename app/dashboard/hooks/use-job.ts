"use client";

import useSWR from "swr";
import { getJob, type ApiError } from "@/lib/client/api";
import type { JobStatusResponse } from "@/types/api";

const ACTIVE_STATES = new Set<JobStatusResponse["state"]>(["queued", "running"]);

export function jobKey(jobId: string): string {
  return `/api/jobs/${jobId}`;
}

/**
 * Polls a single job. We poll fast (1s) while it's in flight and stop
 * polling completely once it reaches a terminal state, which keeps the
 * jobs tray cheap even if the user leaves the page open.
 */
export function useJob(jobId: string) {
  const { data, error, isLoading, mutate } = useSWR<JobStatusResponse, ApiError>(
    jobKey(jobId),
    () => getJob(jobId),
    {
      refreshInterval: (latest) =>
        latest && !ACTIVE_STATES.has(latest.state) ? 0 : 1000,
      revalidateOnFocus: true,
      dedupingInterval: 500,
    },
  );
  return { data, error, isLoading, mutate };
}

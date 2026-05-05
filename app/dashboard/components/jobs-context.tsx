"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Tracked-jobs registry shared between the ingest form (which adds jobs)
 * and the jobs tray (which renders + polls them). Lives in client memory
 * only — on full reload the tray clears, but in-flight server-side jobs
 * keep running and their results show up in the items grid as it
 * refreshes.
 */
export interface TrackedJob {
  jobId: string;
  /** The URL the user pasted, kept here so the tray can render it before
   *  the first poll completes. */
  sourceUrl: string;
}

interface JobsContextValue {
  jobs: TrackedJob[];
  trackJob: (job: TrackedJob) => void;
  dismissJob: (jobId: string) => void;
}

const JobsContext = createContext<JobsContextValue | null>(null);

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<TrackedJob[]>([]);

  const trackJob = useCallback((job: TrackedJob) => {
    setJobs((prev) => {
      if (prev.some((j) => j.jobId === job.jobId)) return prev;
      return [job, ...prev];
    });
  }, []);

  const dismissJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
  }, []);

  const value = useMemo<JobsContextValue>(
    () => ({ jobs, trackJob, dismissJob }),
    [jobs, trackJob, dismissJob],
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobsContext(): JobsContextValue {
  const ctx = useContext(JobsContext);
  if (!ctx) {
    throw new Error("useJobsContext must be used inside <JobsProvider>");
  }
  return ctx;
}

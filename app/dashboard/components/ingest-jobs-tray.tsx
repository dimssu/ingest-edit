"use client";

import { JobCard } from "@/app/dashboard/components/job-card";
import { useJobsContext } from "@/app/dashboard/components/jobs-context";

export function IngestJobsTray() {
  const { jobs } = useJobsContext();

  if (jobs.length === 0) return null;

  return (
    <section aria-label="Ingest jobs" className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        In progress
      </h3>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {jobs.map((job) => (
          <li key={job.jobId}>
            <JobCard job={job} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Dev-only mock data that mirrors the API contracts in `types/api.ts`.
 *
 * Activated by `NEXT_PUBLIC_USE_FAKE_DATA=1` and only when not in
 * production. Lets QA see the populated dashboard before real creds (Mongo,
 * AWS, Instagram cookies) are wired in.
 *
 * Keep this file tiny and explicitly typed against the shared types — if
 * the API contract drifts, TypeScript will yell here.
 */

import type {
  IngestResponse,
  ItemListResponse,
  ItemSummary,
  JobStatusResponse,
} from "@/types/api";

const now = Date.now();
const isoMinusMinutes = (m: number) => new Date(now - m * 60_000).toISOString();
const isoMinusHours = (h: number) => new Date(now - h * 3_600_000).toISOString();
const isoMinusDays = (d: number) => new Date(now - d * 86_400_000).toISOString();

const fakeItems: ItemSummary[] = [
  {
    itemId: "itm_demo_a1b2c3",
    sourceUrl: "https://www.instagram.com/reel/Cz9ABCDEFGH/",
    sourcePlatform: "instagram",
    thumbnailUrl: undefined,
    durationMs: 32_400,
    width: 1080,
    height: 1920,
    createdAt: isoMinusMinutes(14),
  },
  {
    itemId: "itm_demo_d4e5f6",
    sourceUrl: "https://www.instagram.com/p/Cy8XYZGHIJK/",
    sourcePlatform: "instagram",
    thumbnailUrl: undefined,
    durationMs: 67_120,
    width: 1080,
    height: 1080,
    createdAt: isoMinusHours(3),
  },
  {
    itemId: "itm_demo_g7h8i9",
    sourceUrl: "https://www.instagram.com/reels/Cw1LMNOPQRS/",
    sourcePlatform: "instagram",
    thumbnailUrl: undefined,
    durationMs: 14_750,
    width: 720,
    height: 1280,
    createdAt: isoMinusDays(1),
  },
  {
    itemId: "itm_demo_j0k1l2",
    sourceUrl: "https://www.instagram.com/tv/Ct5TUVWXYZA/",
    sourcePlatform: "instagram",
    thumbnailUrl: undefined,
    durationMs: 184_900,
    width: 1080,
    height: 1920,
    createdAt: isoMinusDays(4),
  },
];

export const fakeItemList: ItemListResponse = {
  items: fakeItems,
};

export const fakeRunningJobId = "job_demo_running";
export const fakeSucceededJobId = "job_demo_succeeded";

export const fakeJobs: Record<string, JobStatusResponse> = {
  [fakeRunningJobId]: {
    jobId: fakeRunningJobId,
    userId: "dev-user-1",
    kind: "ingest",
    state: "running",
    progress: 0.42,
    payload: {
      kind: "ingest",
      sourceUrl: "https://www.instagram.com/reel/Cz9NEWESTONE/",
      userId: "dev-user-1",
    },
    attempts: 1,
    startedAt: isoMinusMinutes(1),
    createdAt: isoMinusMinutes(1),
    updatedAt: isoMinusMinutes(0),
  },
  [fakeSucceededJobId]: {
    jobId: fakeSucceededJobId,
    userId: "dev-user-1",
    kind: "ingest",
    state: "succeeded",
    progress: 1,
    payload: {
      kind: "ingest",
      sourceUrl: "https://www.instagram.com/reel/Cz9PRIORONE/",
      userId: "dev-user-1",
    },
    result: { itemId: "itm_demo_a1b2c3" },
    relatedItemId: "itm_demo_a1b2c3",
    attempts: 1,
    startedAt: isoMinusMinutes(15),
    finishedAt: isoMinusMinutes(13),
    createdAt: isoMinusMinutes(15),
    updatedAt: isoMinusMinutes(13),
  },
};

export function fakeIngestResponse(sourceUrl: string): {
  response: IngestResponse;
  job: JobStatusResponse;
} {
  const jobId = `job_demo_${Math.random().toString(36).slice(2, 8)}`;
  const created = new Date().toISOString();
  const job: JobStatusResponse = {
    jobId,
    userId: "dev-user-1",
    kind: "ingest",
    state: "queued",
    progress: 0,
    payload: { kind: "ingest", sourceUrl, userId: "dev-user-1" },
    attempts: 0,
    createdAt: created,
    updatedAt: created,
  };
  fakeJobs[jobId] = job;
  // Simulate progress over time so the UI animates while watching it.
  let pct = 0;
  const tick = () => {
    const j = fakeJobs[jobId];
    if (!j || j.state === "succeeded" || j.state === "failed") return;
    pct = Math.min(1, pct + 0.18 + Math.random() * 0.1);
    if (pct >= 1) {
      const itemId = `itm_demo_${Math.random().toString(36).slice(2, 8)}`;
      fakeJobs[jobId] = {
        ...j,
        state: "succeeded",
        progress: 1,
        result: { itemId },
        relatedItemId: itemId,
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // Push a fresh item to the top of the list when the fake job lands.
      fakeItemList.items = [
        {
          itemId,
          sourceUrl,
          sourcePlatform: "instagram",
          durationMs: 18_000 + Math.floor(Math.random() * 60_000),
          width: 1080,
          height: 1920,
          createdAt: new Date().toISOString(),
        },
        ...fakeItemList.items,
      ];
      return;
    }
    fakeJobs[jobId] = {
      ...j,
      state: "running",
      progress: pct,
      startedAt: j.startedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTimeout(tick, 1200);
  };
  setTimeout(tick, 600);

  return { response: { jobId, state: "queued" }, job };
}

// Note: the runtime flag check lives in `lib/client/fake-data-flag.ts` so
// callers can gate on it without statically importing this (larger) file.

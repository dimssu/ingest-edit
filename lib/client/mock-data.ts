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
  AudioAssetSummary,
  IngestResponse,
  ItemDetail,
  ItemDetailResponse,
  ItemListResponse,
  ItemSummary,
  JobStatusResponse,
  VersionSummary,
} from "@/types/api";

import { ApiError } from "@/lib/client/api";

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

// ---- /api/items/[itemId] mocks --------------------------------------------

interface FakeItemDetailSeed {
  item: ItemDetail;
  versions: VersionSummary[];
  audioAssets: AudioAssetSummary[];
}

function buildSeed(
  base: ItemSummary,
  overrides: {
    videoCodec: string;
    audioCodec?: string;
    framerate?: number;
    fileSizeBytes?: number;
    versions: Array<{
      versionId: string;
      parentVersionId: string | null;
      label: string;
      durationMs: number;
      op: string;
      params?: Record<string, unknown>;
      ageMinutes: number;
      videoCodec?: string;
      audioCodec?: string;
      width?: number;
      height?: number;
      fileSizeBytes?: number;
    }>;
    audioAssets: Array<{
      assetId: string;
      sourceVersionId?: string;
      format: string;
      durationMs: number;
      sampleRate?: number;
      channels?: number;
      fileSizeBytes?: number;
      label?: string;
      ageMinutes: number;
    }>;
  },
): FakeItemDetailSeed {
  const item: ItemDetail = {
    itemId: base.itemId,
    sourceUrl: base.sourceUrl,
    sourcePlatform: base.sourcePlatform,
    videoUrl: undefined,
    thumbnailUrl: undefined,
    durationMs: base.durationMs,
    width: base.width,
    height: base.height,
    videoCodec: overrides.videoCodec,
    audioCodec: overrides.audioCodec,
    framerate: overrides.framerate,
    fileSizeBytes: overrides.fileSizeBytes,
    createdAt: base.createdAt,
    updatedAt: base.createdAt,
  };

  const versions: VersionSummary[] = overrides.versions.map((v) => ({
    versionId: v.versionId,
    itemId: base.itemId,
    parentVersionId: v.parentVersionId,
    label: v.label,
    videoUrl: undefined,
    durationMs: v.durationMs,
    derivedFrom: { op: v.op, params: v.params ?? {} },
    width: v.width ?? base.width,
    height: v.height ?? base.height,
    videoCodec: v.videoCodec ?? overrides.videoCodec,
    audioCodec: v.audioCodec ?? overrides.audioCodec,
    fileSizeBytes: v.fileSizeBytes,
    createdAt: isoMinusMinutes(v.ageMinutes),
  }));

  const audioAssets: AudioAssetSummary[] = overrides.audioAssets.map((a) => ({
    assetId: a.assetId,
    itemId: base.itemId,
    sourceVersionId: a.sourceVersionId,
    audioUrl: undefined,
    format: a.format,
    durationMs: a.durationMs,
    sampleRate: a.sampleRate,
    channels: a.channels,
    fileSizeBytes: a.fileSizeBytes,
    label: a.label,
    createdAt: isoMinusMinutes(a.ageMinutes),
  }));

  return { item, versions, audioAssets };
}

const fakeItemDetailSeeds: Record<string, FakeItemDetailSeed> = {
  [fakeItems[0].itemId]: buildSeed(fakeItems[0], {
    videoCodec: "h264",
    audioCodec: "aac",
    framerate: 29.97,
    fileSizeBytes: 7_421_337,
    versions: [
      {
        versionId: "ver_a1b2_root",
        parentVersionId: null,
        label: "Original",
        durationMs: fakeItems[0].durationMs,
        op: "original",
        ageMinutes: 14,
      },
      {
        versionId: "ver_a1b2_trim_1",
        parentVersionId: "ver_a1b2_root",
        label: "Hook trim",
        durationMs: 18_120,
        op: "trim",
        params: { startMs: 0, endMs: 18_120 },
        ageMinutes: 11,
        fileSizeBytes: 4_181_004,
      },
      {
        versionId: "ver_a1b2_swap_1",
        parentVersionId: "ver_a1b2_trim_1",
        label: "Hook trim · new audio",
        durationMs: 18_120,
        op: "audio-swap",
        params: { audioAssetId: "aud_a1b2_lofi" },
        ageMinutes: 7,
        audioCodec: "aac",
        fileSizeBytes: 4_402_551,
      },
    ],
    audioAssets: [
      {
        assetId: "aud_a1b2_orig",
        sourceVersionId: "ver_a1b2_root",
        format: "aac",
        durationMs: fakeItems[0].durationMs,
        sampleRate: 48_000,
        channels: 2,
        fileSizeBytes: 511_200,
        label: "Original soundtrack",
        ageMinutes: 13,
      },
      {
        assetId: "aud_a1b2_lofi",
        format: "mp3",
        durationMs: 22_400,
        sampleRate: 44_100,
        channels: 2,
        fileSizeBytes: 358_400,
        label: "Lofi loop",
        ageMinutes: 9,
      },
    ],
  }),
  [fakeItems[1].itemId]: buildSeed(fakeItems[1], {
    videoCodec: "h264",
    audioCodec: "aac",
    framerate: 30,
    fileSizeBytes: 12_904_220,
    versions: [
      {
        versionId: "ver_d4e5_root",
        parentVersionId: null,
        label: "Original",
        durationMs: fakeItems[1].durationMs,
        op: "original",
        ageMinutes: 180,
      },
      {
        versionId: "ver_d4e5_trim_1",
        parentVersionId: "ver_d4e5_root",
        label: "First half",
        durationMs: 33_500,
        op: "trim",
        params: { startMs: 0, endMs: 33_500 },
        ageMinutes: 160,
      },
      {
        versionId: "ver_d4e5_trim_2",
        parentVersionId: "ver_d4e5_root",
        label: "Second half",
        durationMs: 33_620,
        op: "trim",
        params: { startMs: 33_500, endMs: 67_120 },
        ageMinutes: 158,
      },
      {
        versionId: "ver_d4e5_concat_1",
        parentVersionId: "ver_d4e5_trim_2",
        label: "Reordered cut",
        durationMs: 67_120,
        op: "concat",
        params: { sources: ["ver_d4e5_trim_2", "ver_d4e5_trim_1"] },
        ageMinutes: 120,
      },
    ],
    audioAssets: [
      {
        assetId: "aud_d4e5_orig",
        sourceVersionId: "ver_d4e5_root",
        format: "aac",
        durationMs: fakeItems[1].durationMs,
        sampleRate: 48_000,
        channels: 2,
        fileSizeBytes: 1_080_120,
        label: "Original soundtrack",
        ageMinutes: 179,
      },
      {
        assetId: "aud_d4e5_voiceover",
        format: "wav",
        durationMs: 27_300,
        sampleRate: 48_000,
        channels: 1,
        fileSizeBytes: 2_604_800,
        label: "Voiceover take 2",
        ageMinutes: 95,
      },
    ],
  }),
  [fakeItems[2].itemId]: buildSeed(fakeItems[2], {
    videoCodec: "h264",
    audioCodec: "aac",
    framerate: 24,
    fileSizeBytes: 3_204_800,
    versions: [
      {
        versionId: "ver_g7h8_root",
        parentVersionId: null,
        label: "Original",
        durationMs: fakeItems[2].durationMs,
        op: "original",
        ageMinutes: 60 * 24,
      },
      {
        versionId: "ver_g7h8_extract_1",
        parentVersionId: "ver_g7h8_root",
        label: "Audio pulled",
        durationMs: fakeItems[2].durationMs,
        op: "audio-extract",
        params: {},
        ageMinutes: 60 * 23,
      },
    ],
    audioAssets: [
      {
        assetId: "aud_g7h8_orig",
        sourceVersionId: "ver_g7h8_root",
        format: "aac",
        durationMs: fakeItems[2].durationMs,
        sampleRate: 48_000,
        channels: 2,
        fileSizeBytes: 240_080,
        label: "Original soundtrack",
        ageMinutes: 60 * 24,
      },
      {
        assetId: "aud_g7h8_isolated",
        sourceVersionId: "ver_g7h8_extract_1",
        format: "wav",
        durationMs: fakeItems[2].durationMs,
        sampleRate: 48_000,
        channels: 2,
        fileSizeBytes: 1_410_080,
        label: "Isolated dialog",
        ageMinutes: 60 * 23,
      },
    ],
  }),
  [fakeItems[3].itemId]: buildSeed(fakeItems[3], {
    videoCodec: "h264",
    audioCodec: "aac",
    framerate: 60,
    fileSizeBytes: 38_201_600,
    versions: [
      {
        versionId: "ver_j0k1_root",
        parentVersionId: null,
        label: "Original",
        durationMs: fakeItems[3].durationMs,
        op: "original",
        ageMinutes: 60 * 24 * 4,
      },
      {
        versionId: "ver_j0k1_split_1",
        parentVersionId: "ver_j0k1_root",
        label: "Cold open",
        durationMs: 42_000,
        op: "split",
        params: { startMs: 0, endMs: 42_000 },
        ageMinutes: 60 * 24 * 4 - 30,
      },
      {
        versionId: "ver_j0k1_split_2",
        parentVersionId: "ver_j0k1_root",
        label: "Main beat",
        durationMs: 100_900,
        op: "split",
        params: { startMs: 42_000, endMs: 142_900 },
        ageMinutes: 60 * 24 * 4 - 28,
      },
      {
        versionId: "ver_j0k1_append_1",
        parentVersionId: "ver_j0k1_split_2",
        label: "Main + outro",
        durationMs: 142_900,
        op: "append",
        params: { appendVersionId: "ver_j0k1_split_1" },
        ageMinutes: 60 * 24 * 4 - 10,
      },
    ],
    audioAssets: [
      {
        assetId: "aud_j0k1_orig",
        sourceVersionId: "ver_j0k1_root",
        format: "aac",
        durationMs: fakeItems[3].durationMs,
        sampleRate: 48_000,
        channels: 2,
        fileSizeBytes: 2_988_080,
        label: "Original soundtrack",
        ageMinutes: 60 * 24 * 4,
      },
      {
        assetId: "aud_j0k1_score",
        format: "mp3",
        durationMs: 184_900,
        sampleRate: 44_100,
        channels: 2,
        fileSizeBytes: 2_961_600,
        label: "Custom score draft",
        ageMinutes: 60 * 24 * 3,
      },
    ],
  }),
};

/**
 * Returns a coherent fake item-detail payload for one of the seeded item ids.
 * Throws an `ApiError(status:404)` for unknown ids so the canvas error UI
 * can show a graceful 404 — matching the real API contract.
 */
export function fakeItemDetailFor(itemId: string): ItemDetailResponse {
  const seed = fakeItemDetailSeeds[itemId];
  if (!seed) {
    throw new ApiError("ITEM_NOT_FOUND", `No item with id ${itemId}.`, 404);
  }
  return {
    item: { ...seed.item },
    versions: seed.versions.map((v) => ({ ...v })),
    audioAssets: seed.audioAssets.map((a) => ({ ...a })),
  };
}

// Note: the runtime flag check lives in `lib/client/fake-data-flag.ts` so
// callers can gate on it without statically importing this (larger) file.

/**
 * Tiny typed fetch wrapper used by SWR hooks and direct mutations. Maps
 * the server's `errorResponse` envelope (see `lib/server/http.ts`) into a
 * thrown `ApiError` with the original `code`, `message`, and any
 * `details`.
 *
 * When `NEXT_PUBLIC_USE_FAKE_DATA=1` (and we're not in production) we
 * short-circuit to deterministic mock data so the UI populates without
 * backend creds. The mock layer is intentionally narrow — only the
 * endpoints the dashboard hits.
 */

import type {
  AudioExtractRequest,
  AudioSwapRequest,
  EnqueueJobResponse,
  IngestRequestBody,
  IngestResponse,
  ItemDetailResponse,
  ItemListResponse,
  JobStatusResponse,
} from "@/types/api";
import { fakeDataEnabled } from "@/lib/client/fake-data-flag";

// Mock data is loaded via dynamic import so webpack splits it into a
// separate chunk that production browsers never fetch.
async function loadMocks() {
  return await import("@/lib/client/mock-data");
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface ServerErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

function isErrorEnvelope(value: unknown): value is ServerErrorEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { error?: unknown };
  if (typeof v.error !== "object" || v.error === null) return false;
  const e = v.error as { code?: unknown; message?: unknown };
  return typeof e.code === "string" && typeof e.message === "string";
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  // Try JSON first; fall back to status text if the body isn't JSON.
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON — handled below
    }
  }

  if (!res.ok) {
    if (isErrorEnvelope(body)) {
      throw new ApiError(
        body.error.code,
        body.error.message,
        res.status,
        body.error.details,
      );
    }
    throw new ApiError(
      "INTERNAL_ERROR",
      text || res.statusText || "Request failed",
      res.status,
    );
  }

  return body as T;
}

export const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  return parseOrThrow<T>(res);
};

// ---- typed endpoints -------------------------------------------------------

export async function getItems(): Promise<ItemListResponse> {
  if (fakeDataEnabled()) {
    const { fakeItemList } = await loadMocks();
    // Shallow clone to avoid SWR cache mutating mock state between renders.
    return { items: [...fakeItemList.items] };
  }
  return fetcher<ItemListResponse>("/api/items");
}

export async function getItemDetail(
  itemId: string,
): Promise<ItemDetailResponse> {
  if (fakeDataEnabled()) {
    const { fakeItemDetailFor } = await loadMocks();
    // fakeItemDetailFor throws ApiError(404) for unknown ids.
    return fakeItemDetailFor(itemId);
  }
  return fetcher<ItemDetailResponse>(
    `/api/items/${encodeURIComponent(itemId)}`,
  );
}

export async function getJob(jobId: string): Promise<JobStatusResponse> {
  if (fakeDataEnabled()) {
    const { fakeJobs } = await loadMocks();
    const j = fakeJobs[jobId];
    if (!j) {
      throw new ApiError("JOB_NOT_FOUND", `No job with id ${jobId}.`, 404);
    }
    return { ...j };
  }
  return fetcher<JobStatusResponse>(`/api/jobs/${encodeURIComponent(jobId)}`);
}

export async function postIngest(
  body: IngestRequestBody,
): Promise<IngestResponse> {
  if (fakeDataEnabled()) {
    const { fakeIngestResponse } = await loadMocks();
    return fakeIngestResponse(body.sourceUrl).response;
  }
  const res = await fetch("/api/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseOrThrow<IngestResponse>(res);
}

// ---- /api/render -----------------------------------------------------------

/**
 * Wire shape for the render request. Mirrors the zod-derived
 * `RenderRequest` in `types/api.ts`. We re-declare the interface here so
 * `lib/client/api.ts` stays usable without pulling zod into the client
 * bundle for any callers that only need the structural type.
 */
export interface RenderRequest {
  itemId: string;
  baseVersionId: string;
  label?: string;
  clips: Array<{
    sourceVersionId: string;
    startMs: number;
    endMs: number;
  }>;
}

export type RenderResponse = EnqueueJobResponse;

/**
 * Submits an edit spec for rendering. The endpoint persists a queued
 * render job and returns the `jobId` (202). Clients poll
 * `/api/jobs/[jobId]` for state and read `result.versionId` on success.
 *
 * In fake-data mode we synthesize a job that animates 0→100 and adds a
 * fresh Version to the seeded item-detail when it lands.
 */
export async function postRender(req: RenderRequest): Promise<RenderResponse> {
  if (fakeDataEnabled()) {
    const { fakeRenderResponse } = await loadMocks();
    return fakeRenderResponse(req).response;
  }
  const res = await fetch("/api/render", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(req),
  });
  return parseOrThrow<RenderResponse>(res);
}

// ---- /api/audio/extract ----------------------------------------------------

export type AudioExtractResponse = EnqueueJobResponse;

/**
 * Enqueues an audio-extract job for the given version. Returns `{ jobId }`
 * (202). The executor produces a new AudioAsset whose `sourceVersionId` is
 * the input version. Poll `/api/jobs/[jobId]` for state.
 */
export async function postAudioExtract(
  req: AudioExtractRequest,
): Promise<AudioExtractResponse> {
  if (fakeDataEnabled()) {
    const { fakeAudioExtractResponse } = await loadMocks();
    return fakeAudioExtractResponse(req).response;
  }
  const res = await fetch("/api/audio/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(req),
  });
  return parseOrThrow<AudioExtractResponse>(res);
}

// ---- /api/audio/swap -------------------------------------------------------

export type AudioSwapResponse = EnqueueJobResponse;

/**
 * Enqueues an audio-swap job. The executor produces a new Version whose
 * audio track is replaced by the chosen AudioAsset. Poll
 * `/api/jobs/[jobId]` for state and read `result.versionId` on success.
 */
export async function postAudioSwap(
  req: AudioSwapRequest,
): Promise<AudioSwapResponse> {
  if (fakeDataEnabled()) {
    const { fakeAudioSwapResponse } = await loadMocks();
    return fakeAudioSwapResponse(req).response;
  }
  const res = await fetch("/api/audio/swap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(req),
  });
  return parseOrThrow<AudioSwapResponse>(res);
}

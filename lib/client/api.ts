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

"use client";

import useSWR from "swr";

import { getItemDetail, type ApiError } from "@/lib/client/api";
import type { ItemDetailResponse } from "@/types/api";

export function itemDetailKey(itemId: string): string {
  return `/api/items/${itemId}`;
}

/**
 * Loads `/api/items/[itemId]`. We keep the cadence calm — the canvas is a
 * read-mostly surface and the version graph only changes when the user
 * triggers a render, so we revalidate on focus and skip background polling.
 */
export function useItemDetail(itemId: string) {
  const { data, error, isLoading, mutate } = useSWR<
    ItemDetailResponse,
    ApiError
  >(itemDetailKey(itemId), () => getItemDetail(itemId), {
    revalidateOnFocus: true,
    dedupingInterval: 4000,
    // 404s shouldn't keep retrying — surface them through the error UI.
    shouldRetryOnError: (err) => err.status !== 404,
  });
  return { data, error, isLoading, mutate };
}

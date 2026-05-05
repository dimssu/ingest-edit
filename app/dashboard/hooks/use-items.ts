"use client";

import useSWR from "swr";
import { getItems, type ApiError } from "@/lib/client/api";
import type { ItemListResponse } from "@/types/api";

export const ITEMS_KEY = "/api/items";

export function useItems() {
  const { data, error, isLoading, mutate } = useSWR<ItemListResponse, ApiError>(
    ITEMS_KEY,
    () => getItems(),
    {
      // Re-fetch when the user comes back to the tab; keep a calm cadence
      // otherwise — the jobs tray drives most of the freshness via mutate().
      revalidateOnFocus: true,
      dedupingInterval: 4000,
    },
  );
  return { data, error, isLoading, mutate };
}

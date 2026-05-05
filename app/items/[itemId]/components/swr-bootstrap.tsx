"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

import { itemDetailKey } from "@/app/items/[itemId]/hooks/use-item-detail";
import type { ItemDetailResponse } from "@/types/api";

interface SwrBootstrapProps {
  itemId: string;
  initialDetail?: ItemDetailResponse;
  children: ReactNode;
}

/**
 * Seeds SWR's cache with server-rendered item-detail data so the canvas
 * paints fully populated on first byte (matters for fake-data dev preview
 * and any future SSR-with-real-creds path). Client SWR still revalidates.
 */
export function SwrBootstrap({
  itemId,
  initialDetail,
  children,
}: SwrBootstrapProps) {
  const fallback: Record<string, unknown> = {};
  if (initialDetail) fallback[itemDetailKey(itemId)] = initialDetail;
  return <SWRConfig value={{ fallback }}>{children}</SWRConfig>;
}

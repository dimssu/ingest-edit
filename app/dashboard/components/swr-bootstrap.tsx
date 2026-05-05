"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

import { ITEMS_KEY } from "@/app/dashboard/hooks/use-items";
import type { ItemListResponse } from "@/types/api";

interface SwrBootstrapProps {
  initialItems?: ItemListResponse;
  children: ReactNode;
}

/**
 * Seeds SWR's cache with server-rendered data so the populated dashboard
 * is visible in the initial HTML (matters for both the dev fake-data
 * preview and any future SSR-with-real-creds path). Client-side SWR
 * still revalidates after hydration as usual.
 */
export function SwrBootstrap({ initialItems, children }: SwrBootstrapProps) {
  const fallback: Record<string, unknown> = {};
  if (initialItems) fallback[ITEMS_KEY] = initialItems;

  return <SWRConfig value={{ fallback }}>{children}</SWRConfig>;
}

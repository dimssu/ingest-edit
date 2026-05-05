"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton that mirrors the three-column canvas layout so the
 * page doesn't reflow as data lands.
 */
export function CanvasLoading() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
      <aside className="space-y-5">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </aside>

      <section className="space-y-4">
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-6" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-card/40 p-4"
              style={{ marginInlineStart: `${(i % 3) * 20}px` }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="mt-3 h-3 w-24" />
            </div>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>
      </aside>

      <div className="lg:col-span-3">
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-56 shrink-0 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

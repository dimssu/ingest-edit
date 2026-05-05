"use client";

import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";

import {
  formatDuration,
  formatRelativeTime,
  hostnameOf,
} from "@/lib/client/format";
import type { ItemSummary } from "@/types/api";

interface ItemCardProps {
  item: ItemSummary;
}

export function ItemCard({ item }: ItemCardProps) {
  return (
    <Link
      href={`/items/${item.itemId}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:-translate-y-0.5 focus-visible:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`Open item from ${hostnameOf(item.sourceUrl)}`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,oklch(var(--muted-foreground)/0.08),transparent_70%)]"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-sm backdrop-blur-sm">
              <Play className="size-4 translate-x-px" aria-hidden />
            </div>
          </div>
        )}
        <span className="absolute bottom-2 right-2 rounded-md bg-background/85 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-foreground shadow-sm backdrop-blur-sm">
          {formatDuration(item.durationMs)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="truncate text-sm font-medium text-foreground">
          {hostnameOf(item.sourceUrl)}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatRelativeTime(item.createdAt)}
        </span>
      </div>
    </Link>
  );
}

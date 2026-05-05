"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemCard } from "@/app/dashboard/components/item-card";
import { useItems } from "@/app/dashboard/hooks/use-items";

const SKELETON_COUNT = 6;

function ItemCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

export function ItemsGrid() {
  const { data, error, isLoading, mutate } = useItems();

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <ItemCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          Couldn’t load items. {error.message}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void mutate();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-32 text-center">
        <p className="text-base font-medium text-foreground">No items yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Paste an Instagram link above to ingest your first video.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.itemId}>
          <ItemCard item={item} />
        </li>
      ))}
    </ul>
  );
}

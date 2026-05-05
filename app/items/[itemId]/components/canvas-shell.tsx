"use client";

import { useMemo, useState } from "react";

import { useItemDetail } from "@/app/items/[itemId]/hooks/use-item-detail";

import { ActionPanel } from "./action-panel";
import { AudioStrip } from "./audio-strip";
import { CanvasError } from "./canvas-error";
import { CanvasLoading } from "./canvas-loading";
import { SourceRail } from "./source-rail";
import { VersionGraph } from "./version-graph";

interface CanvasShellProps {
  itemId: string;
}

/**
 * Orchestrates the per-item canvas: holds the focused-version state and
 * stitches together the three columns + bottom audio strip. The focused
 * version is derived: an explicit user pick when present and still valid,
 * otherwise the root version (parentVersionId === null). Computing this
 * during render avoids a setState-in-effect cascade.
 */
export function CanvasShell({ itemId }: CanvasShellProps) {
  const { data, error, isLoading, mutate } = useItemDetail(itemId);

  const versions = useMemo(() => data?.versions ?? [], [data]);
  const audioAssets = data?.audioAssets ?? [];

  const rootVersionId = useMemo(() => {
    const root = versions.find((v) => v.parentVersionId === null);
    return root?.versionId ?? versions[0]?.versionId ?? null;
  }, [versions]);

  // `pickedVersionId` is the user's explicit click; null until they pick.
  const [pickedVersionId, setPickedVersionId] = useState<string | null>(null);

  // Effective focus: a still-valid pick, otherwise the root.
  const focusedVersionId = useMemo(() => {
    if (
      pickedVersionId &&
      versions.some((v) => v.versionId === pickedVersionId)
    ) {
      return pickedVersionId;
    }
    return rootVersionId;
  }, [pickedVersionId, rootVersionId, versions]);

  const focused = versions.find((v) => v.versionId === focusedVersionId);

  if (error) {
    return (
      <CanvasError
        error={error}
        onRetry={() => {
          void mutate();
        }}
      />
    );
  }

  if (isLoading && !data) {
    return <CanvasLoading />;
  }

  if (!data) {
    return <CanvasLoading />;
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
      {/* On lg+: left rail. On mobile: source comes first. */}
      <div className="lg:order-1 order-1">
        <SourceRail item={data.item} />
      </div>

      {/* On lg+: middle column. On mobile: versions land third. */}
      <div className="min-w-0 lg:order-2 order-3">
        <VersionGraph
          versions={versions}
          focusedVersionId={focusedVersionId}
          onFocus={setPickedVersionId}
        />
      </div>

      {/* On lg+: right rail. On mobile: action panel comes second under source. */}
      <div className="lg:order-3 order-2">
        <ActionPanel itemId={itemId} focused={focused} />
      </div>

      <div className="lg:col-span-3 lg:order-4 order-4">
        <div className="border-t border-border/60 pt-6">
          <AudioStrip assets={audioAssets} versions={versions} />
        </div>
      </div>
    </div>
  );
}

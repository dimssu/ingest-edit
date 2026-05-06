"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

const FOCUS_VERSION_PARAM = "focusVersion";

/**
 * Orchestrates the per-item canvas: holds the focused-version state and
 * stitches together the three columns + bottom audio strip. The focused
 * version is derived: an explicit user pick when present and still valid,
 * otherwise the URL `?focusVersion=` query (if it points to a known
 * version), otherwise the root version. Computing this during render
 * avoids a setState-in-effect cascade.
 */
export function CanvasShell({ itemId }: CanvasShellProps) {
  const { data, error, isLoading, mutate } = useItemDetail(itemId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusParam = searchParams.get(FOCUS_VERSION_PARAM);

  const versions = useMemo(() => data?.versions ?? [], [data]);
  const audioAssets = data?.audioAssets ?? [];

  const rootVersionId = useMemo(() => {
    const root = versions.find((v) => v.parentVersionId === null);
    return root?.versionId ?? versions[0]?.versionId ?? null;
  }, [versions]);

  // `pickedVersionId` is the user's explicit click; null until they pick.
  const [pickedVersionId, setPickedVersionId] = useState<string | null>(null);

  // Effective focus: pick (if still valid) > URL param (if valid) > root.
  const focusedVersionId = useMemo(() => {
    if (
      pickedVersionId &&
      versions.some((v) => v.versionId === pickedVersionId)
    ) {
      return pickedVersionId;
    }
    if (
      focusParam &&
      versions.some((v) => v.versionId === focusParam)
    ) {
      return focusParam;
    }
    return rootVersionId;
  }, [pickedVersionId, focusParam, rootVersionId, versions]);

  // Stale `?focusVersion=` (e.g. shared link from a deleted version) →
  // clear it from the URL so the back/forward stack stays clean and the
  // focus falls back to root. We delay the clear to give SWR time to
  // revalidate; otherwise a freshly-rendered version (just produced by a
  // render job on the editor page) could be wiped from the URL during the
  // ~tens of ms between mount and the next SWR refetch landing.
  useEffect(() => {
    if (!data) return;
    if (!focusParam) return;
    if (versions.some((v) => v.versionId === focusParam)) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete(FOCUS_VERSION_PARAM);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [data, focusParam, versions, searchParams, router, pathname]);

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
        <ActionPanel
          itemId={itemId}
          focused={focused}
          audioAssets={audioAssets}
          onJobComplete={(versionId) => {
            // Refresh the item detail so the new version/asset shows up,
            // and pull focus to the new version if one was produced.
            void mutate();
            if (versionId) {
              setPickedVersionId(versionId);
            }
          }}
        />
      </div>

      <div className="lg:col-span-3 lg:order-4 order-4">
        <div className="border-t border-border/60 pt-6">
          <AudioStrip assets={audioAssets} versions={versions} />
        </div>
      </div>
    </div>
  );
}

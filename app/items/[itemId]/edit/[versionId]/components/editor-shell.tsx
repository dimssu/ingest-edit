"use client";

import { useMemo } from "react";

import { useItemDetail } from "@/app/items/[itemId]/hooks/use-item-detail";
import { Toaster } from "@/components/ui/sonner";

import { ClipList } from "./clip-list";
import { EditorError } from "./editor-error";
import { EditorHeader } from "./editor-header";
import { EditorLoading } from "./editor-loading";
import { EditSpecProvider } from "./edit-spec-context";
import { Player } from "./player";
import { Timeline } from "./timeline";
import { ToolsPanel } from "./tools-panel";

interface EditorShellProps {
  itemId: string;
  versionId: string;
}

/**
 * The editor's runtime composition. Resolves the focused version from the
 * fetched item-detail, then mounts the EditSpecProvider seeded with that
 * version. Everything below the provider sees a single shared spec state.
 */
export function EditorShell({ itemId, versionId }: EditorShellProps) {
  const { data, error, isLoading, mutate } = useItemDetail(itemId);

  const focused = useMemo(() => {
    if (!data) return undefined;
    return data.versions.find((v) => v.versionId === versionId);
  }, [data, versionId]);

  // Lookups by sourceVersionId for the player + clip list.
  const { videoUrlByVersionId, posterByVersionId, labelByVersionId } = useMemo(() => {
    const videoUrl = new Map<string, string | undefined>();
    const poster = new Map<string, string | undefined>();
    const label = new Map<string, string>();
    if (data) {
      for (const v of data.versions) {
        videoUrl.set(v.versionId, v.videoUrl);
        poster.set(v.versionId, data.item.thumbnailUrl);
        label.set(v.versionId, v.label);
      }
    }
    return {
      videoUrlByVersionId: videoUrl,
      posterByVersionId: poster,
      labelByVersionId: label,
    };
  }, [data]);

  if (error) {
    // 404 from the item itself bubbles here; surface as load-failed.
    return (
      <div className="mx-auto w-full max-w-[1600px] px-6 py-10 md:px-8">
        <EditorError
          itemId={itemId}
          kind="load-failed"
          error={error}
          onRetry={() => void mutate()}
        />
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-6 py-6 md:px-8">
        <EditorLoading />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-6 py-6 md:px-8">
        <EditorLoading />
      </div>
    );
  }

  if (!focused) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-6 py-10 md:px-8">
        <EditorError itemId={itemId} kind="missing-version" />
      </div>
    );
  }

  // Aspect ratio fallback to 16/9 when item dims are missing or zero.
  const aspectRatio =
    data.item.width > 0 && data.item.height > 0
      ? data.item.width / data.item.height
      : 16 / 9;

  return (
    <EditSpecProvider
      init={{
        versionId: focused.versionId,
        label: focused.label,
        durationMs: focused.durationMs,
      }}
    >
      <div className="flex min-h-screen flex-col">
        <EditorHeader
          itemId={itemId}
          versionLabel={focused.label}
          versionId={focused.versionId}
        />

        <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-4 px-6 py-5 md:px-8">
          {/* Top: player + tools side by side on desktop. */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Player
              videoUrlByVersionId={videoUrlByVersionId}
              posterByVersionId={posterByVersionId}
              aspectRatio={aspectRatio}
            />
            <ToolsPanel
              versions={data.versions}
              focusedVersionId={focused.versionId}
            />
          </section>

          {/* Middle: timeline. */}
          <Timeline labelByVersionId={labelByVersionId} />

          {/* Bottom: clip list. (Stays under the timeline; deliberate
              vertical flow rather than a narrow side rail so reorder
              affordances don't crowd the edit verbs.) */}
          <ClipList versions={data.versions} />

          {/* Below-1024px guidance per the frontend brief. */}
          <p className="rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-center text-[11px] text-muted-foreground lg:hidden">
            The editor is desktop-first. For full layout, open on a screen
            wider than 1024px.
          </p>
        </main>

        {/* Sonner is mounted here so the editor's own toasts surface
            without depending on the dashboard's mount. */}
        <Toaster position="bottom-right" />
      </div>
    </EditSpecProvider>
  );
}

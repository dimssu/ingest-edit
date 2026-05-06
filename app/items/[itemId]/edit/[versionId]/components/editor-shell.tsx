"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useItemDetail } from "@/app/items/[itemId]/hooks/use-item-detail";
import { buttonVariants } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

import { ClipList } from "./clip-list";
import { EditorError } from "./editor-error";
import { EditorHeader } from "./editor-header";
import { EditorLoading } from "./editor-loading";
import { EditSpecProvider } from "./edit-spec-context";
import { Player } from "./player";
import { RenderingOverlay } from "./rendering-overlay";
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
 *
 * Owns the in-flight render `jobId` so the rendering overlay survives any
 * re-renders inside the header / timeline subtree.
 */
export function EditorShell({ itemId, versionId }: EditorShellProps) {
  const { data, error, isLoading, mutate } = useItemDetail(itemId);
  const [pendingRenderJobId, setPendingRenderJobId] = useState<string | null>(
    null,
  );

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
          rendering={pendingRenderJobId !== null}
          onRenderEnqueued={(jobId) => setPendingRenderJobId(jobId)}
        />

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-5 md:px-8">
          {/* Below-1024px gate: the timeline editor needs a wide canvas to
              be usable; on small screens we render the gate only. */}
          <div
            className="lg:hidden flex flex-1 items-center justify-center py-16"
            role="status"
          >
            <div className="max-w-sm space-y-3 rounded-lg border border-dashed border-border/60 bg-muted/30 p-6 text-center">
              <h2 className="text-base font-semibold text-foreground">
                Open on a wider screen
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The editor needs at least 1024px to fit the player, timeline,
                and tools side-by-side. Switch to a desktop browser to keep
                editing this version.
              </p>
              <Link
                href={`/items/${itemId}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-2",
                )}
              >
                Back to canvas
              </Link>
            </div>
          </div>

          {/* Desktop body: only renders at lg+. */}
          <div className="hidden lg:block lg:space-y-4">
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
          </div>
        </main>

        {pendingRenderJobId ? (
          <RenderingOverlay
            itemId={itemId}
            jobId={pendingRenderJobId}
            onFailed={() => {
              // Failure toast is fired by the overlay; restore the editor
              // so the user can retry without losing their in-memory spec.
              setPendingRenderJobId(null);
            }}
            onCancel={() => setPendingRenderJobId(null)}
          />
        ) : null}

        {/* Sonner is mounted here so the editor's own toasts surface
            without depending on the dashboard's mount. */}
        <Toaster position="bottom-right" />
      </div>
    </EditSpecProvider>
  );
}

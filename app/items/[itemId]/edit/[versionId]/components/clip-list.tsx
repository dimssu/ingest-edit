"use client";

import { useMemo } from "react";

import { totalDurationMs } from "@/lib/client/edit-spec";
import type { VersionSummary } from "@/types/api";

import { useEditSpec } from "../hooks/use-edit-spec";
import { ClipCard } from "./clip-card";

interface ClipListProps {
  versions: VersionSummary[];
}

/**
 * Vertical list of every clip in the spec, with manual reorder + delete +
 * preview affordances. Drag-and-drop is intentionally Phase 8 — arrows are
 * deterministic, accessible, and good enough for the MVP.
 */
export function ClipList({ versions }: ClipListProps) {
  const {
    state,
    moveClip,
    removeClip,
    setPreviewClip,
    setPlayhead,
  } = useEditSpec();

  const versionById = useMemo(() => {
    return new Map(versions.map((v) => [v.versionId, v]));
  }, [versions]);

  const totalMs = useMemo(() => totalDurationMs(state.spec), [state.spec]);

  // Compute per-clip global ranges once.
  const cumulative = useMemo(() => {
    const out: Array<{ startMs: number; endMs: number }> = [];
    let cursor = 0;
    for (const c of state.spec.clips) {
      const dur = Math.max(0, c.endMs - c.startMs);
      out.push({ startMs: cursor, endMs: cursor + dur });
      cursor += dur;
    }
    return out;
  }, [state.spec.clips]);

  return (
    <section
      aria-label="Clip list"
      className="flex h-full min-h-0 flex-col rounded-xl border border-border/60 bg-card/40"
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Clips
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            ({state.spec.clips.length})
          </span>
        </div>
        <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {totalMs > 0 ? `${(totalMs / 1000).toFixed(2)}s total` : "—"}
        </span>
      </header>

      {state.spec.clips.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-8 text-center text-sm text-muted-foreground">
          No clips. Append a version to start.
        </div>
      ) : (
        <ol className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {state.spec.clips.map((clip, idx) => {
            const range = cumulative[idx] ?? { startMs: 0, endMs: 0 };
            const sourceVersion = versionById.get(clip.sourceVersionId);
            return (
              <ClipCard
                key={clip.id}
                clip={clip}
                index={idx}
                totalClips={state.spec.clips.length}
                globalStartMs={range.startMs}
                globalEndMs={range.endMs}
                sourceLabel={sourceVersion?.label ?? clip.sourceVersionId}
                sourceOp={sourceVersion?.derivedFrom.op ?? "original"}
                isPreview={state.previewClipId === clip.id}
                onPreview={() => {
                  setPreviewClip(clip.id);
                  setPlayhead(range.startMs);
                }}
                onMoveUp={() => moveClip(clip.id, "up")}
                onMoveDown={() => moveClip(clip.id, "down")}
                onRemove={() => removeClip(clip.id)}
              />
            );
          })}
        </ol>
      )}
    </section>
  );
}

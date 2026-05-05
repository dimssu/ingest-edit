"use client";

import { useMemo, useRef } from "react";

import { cn } from "@/lib/utils";
import {
  formatTimecode,
  totalDurationMs,
  type EditSpecClip,
} from "@/lib/client/edit-spec";

import { useEditSpec } from "../hooks/use-edit-spec";
import { TimelineRuler } from "./timeline-ruler";

interface TimelineProps {
  /** Maps sourceVersionId → label for hover tooltips on tracks. */
  labelByVersionId: Map<string, string>;
}

/**
 * Composed-spec timeline: a single horizontal track with each clip drawn
 * as a colored block, plus an interactive ruler for the playhead and the
 * in/out marks.
 *
 * The user clicks anywhere on the row to move the playhead; in/out marks
 * are set via the tools panel.
 */
export function Timeline({ labelByVersionId }: TimelineProps) {
  const { state, setPreviewClip, setPlayhead } = useEditSpec();
  const totalMs = useMemo(() => totalDurationMs(state.spec), [state.spec]);

  const playheadMs = state.playheadMs;
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Compute global ranges for each clip once; reused by the marker
  // overlay and the click-to-seek logic.
  const clipRanges = useMemo(() => {
    const ranges: Array<{
      clip: EditSpecClip;
      startMs: number;
      endMs: number;
    }> = [];
    let cursor = 0;
    for (const c of state.spec.clips) {
      const dur = Math.max(0, c.endMs - c.startMs);
      ranges.push({ clip: c, startMs: cursor, endMs: cursor + dur });
      cursor += dur;
    }
    return ranges;
  }, [state.spec.clips]);

  const seekFromEvent = (
    e: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>,
  ) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const ms = Math.round(ratio * totalMs);
    setPlayhead(ms);
    // Also pivot preview to whichever clip the playhead landed in.
    const hit = clipRanges.find((r) => ms >= r.startMs && ms < r.endMs)
      ?? clipRanges[clipRanges.length - 1];
    if (hit) setPreviewClip(hit.clip.id);
  };

  const inMs = state.inMs;
  const outMs = state.outMs;

  return (
    <section
      aria-label="Edit timeline"
      className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Timeline
        </h3>
        <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-muted-foreground">
          <span>
            <span className="text-muted-foreground/70">Playhead</span>{" "}
            <span className="text-foreground">{formatTimecode(playheadMs)}</span>
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>
            <span className="text-muted-foreground/70">Total</span>{" "}
            <span className="text-foreground">{formatTimecode(totalMs)}</span>
          </span>
        </div>
      </div>

      <TimelineRuler totalMs={totalMs} />

      <div
        ref={trackRef}
        role="slider"
        aria-label="Playhead position on timeline"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, totalMs)}
        aria-valuenow={playheadMs}
        tabIndex={0}
        onKeyDown={(e) => {
          if (totalMs <= 0) return;
          const step = e.shiftKey ? 1000 : 250;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setPlayhead(Math.max(0, playheadMs - step));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setPlayhead(Math.min(totalMs, playheadMs + step));
          } else if (e.key === "Home") {
            e.preventDefault();
            setPlayhead(0);
          } else if (e.key === "End") {
            e.preventDefault();
            setPlayhead(totalMs);
          }
        }}
        onClick={seekFromEvent}
        className={cn(
          "relative h-16 w-full cursor-pointer overflow-hidden rounded-lg bg-muted/40 outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {/* Per-clip blocks. */}
        <div className="absolute inset-0 flex items-stretch gap-px">
          {clipRanges.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Empty timeline.
            </div>
          ) : (
            clipRanges.map(({ clip, startMs, endMs }, idx) => {
              const widthPct =
                totalMs > 0 ? ((endMs - startMs) / totalMs) * 100 : 0;
              const isPreview = state.previewClipId === clip.id;
              const sourceLabel =
                labelByVersionId.get(clip.sourceVersionId) ?? clip.label;
              return (
                <button
                  type="button"
                  key={clip.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewClip(clip.id);
                    setPlayhead(startMs);
                  }}
                  title={`${clip.label} · ${sourceLabel}`}
                  aria-label={`Clip ${idx + 1}: ${clip.label}`}
                  className={cn(
                    "group/clip relative flex h-full min-w-0 items-stretch overflow-hidden border border-border/60 bg-background/90 text-left transition-[transform,box-shadow,background] duration-150",
                    "hover:bg-background hover:shadow-sm",
                    isPreview &&
                      "ring-2 ring-primary/50 ring-offset-1 ring-offset-card",
                  )}
                  style={{ flexBasis: `${widthPct}%` }}
                >
                  {/* Stripe for visual rhythm — odd vs even gives the track
                      structure even when all clips share one source. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0",
                      idx % 2 === 0
                        ? "bg-foreground/[0.04]"
                        : "bg-foreground/[0.075]",
                    )}
                  />
                  <span className="relative z-10 flex w-full flex-col justify-between px-2 py-1.5">
                    <span className="truncate text-[11px] font-medium text-foreground">
                      {clip.label}
                    </span>
                    <span className="truncate font-mono text-[10px] text-muted-foreground tabular-nums">
                      {formatTimecode(startMs)} → {formatTimecode(endMs)}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Range marker (shaded between in & out). */}
        {inMs !== null && outMs !== null && totalMs > 0 ? (
          <div
            className="pointer-events-none absolute inset-y-0 bg-amber-400/15 ring-1 ring-amber-400/30"
            style={{
              left: `${(inMs / totalMs) * 100}%`,
              width: `${((outMs - inMs) / totalMs) * 100}%`,
            }}
          />
        ) : null}
        {/* In point. */}
        {inMs !== null && totalMs > 0 ? (
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-amber-400"
            style={{ left: `${(inMs / totalMs) * 100}%` }}
            aria-hidden
          >
            <span className="absolute -top-1 -translate-x-1/2 rounded-sm bg-amber-400 px-1 py-px font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-950">
              In
            </span>
          </div>
        ) : null}
        {/* Out point. */}
        {outMs !== null && totalMs > 0 ? (
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-amber-400"
            style={{ left: `${(outMs / totalMs) * 100}%` }}
            aria-hidden
          >
            <span className="absolute -top-1 -translate-x-1/2 rounded-sm bg-amber-400 px-1 py-px font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-950">
              Out
            </span>
          </div>
        ) : null}

        {/* Playhead. */}
        {totalMs > 0 ? (
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-foreground"
            style={{ left: `${(playheadMs / totalMs) * 100}%` }}
            aria-hidden
          >
            <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-foreground ring-2 ring-background" />
          </div>
        ) : null}
      </div>

      <TimelinePlayheadHandle
        playheadMs={playheadMs}
        setPlayhead={setPlayhead}
        totalMs={totalMs}
      />
    </section>
  );
}

interface PlayheadHandleProps {
  playheadMs: number;
  setPlayhead: (v: number) => void;
  totalMs: number;
}

/**
 * Tiny helper row exposing the playhead value as a numeric ms field for
 * power users + an action context. Kept a sibling of the track so the
 * track row stays purely visual.
 */
function TimelinePlayheadHandle({
  playheadMs,
  setPlayhead,
  totalMs,
}: PlayheadHandleProps) {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <p className="text-[11px] text-muted-foreground">
        Click anywhere on the track to move the playhead. Use ← / → to nudge,
        Shift+← / → to jump 1s.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPlayhead(0)}
          className="rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[10px] tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Start
        </button>
        <button
          type="button"
          onClick={() => setPlayhead(totalMs)}
          className="rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[10px] tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          End
        </button>
      </div>
      {/* Hidden numeric mirror so anything outside the timeline can subscribe
          via DOM if it needs to (e.g. screen-reader live region in tools). */}
      <span data-playhead-ms={playheadMs} className="sr-only">
        Playhead at {formatTimecode(playheadMs)} of {formatTimecode(totalMs)}.
      </span>
    </div>
  );
}

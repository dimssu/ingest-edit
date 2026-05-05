"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatTimecode } from "@/lib/client/edit-spec";

import { useEditSpec } from "../hooks/use-edit-spec";
import { usePlayer } from "../hooks/use-player";

interface PlayerProps {
  /** Map from sourceVersionId → video URL (may be undefined in fake mode). */
  videoUrlByVersionId: Map<string, string | undefined>;
  /** Map from sourceVersionId → poster (thumbnail). */
  posterByVersionId: Map<string, string | undefined>;
  /** Aspect ratio "w/h", e.g. 16/9. Used to size the player frame. */
  aspectRatio: number;
}

/**
 * Single-source preview player. The user picks which clip to preview from
 * the clip list; the player loads that clip's source video and constrains
 * playback to the clip's `[startMs, endMs]` window.
 */
export function Player({
  videoUrlByVersionId,
  posterByVersionId,
  aspectRatio,
}: PlayerProps) {
  const { state, setPreviewClip } = useEditSpec();
  const {
    videoRef,
    playing,
    currentMs,
    pause,
    toggle,
    seekTo,
  } = usePlayer();

  const previewClip = useMemo(() => {
    const id = state.previewClipId ?? state.spec.clips[0]?.id ?? null;
    return state.spec.clips.find((c) => c.id === id) ?? null;
  }, [state.previewClipId, state.spec.clips]);

  const videoUrl = previewClip
    ? videoUrlByVersionId.get(previewClip.sourceVersionId)
    : undefined;
  const poster = previewClip
    ? posterByVersionId.get(previewClip.sourceVersionId)
    : undefined;

  // Snap the underlying video into the clip's window when the preview clip
  // changes — we don't want playback to drift outside [startMs, endMs].
  // Deps are the primitive fields, not the object, so unrelated spec
  // mutations (e.g. reordering OTHER clips) don't re-seek us back to start.
  const previewClipId = previewClip?.id;
  const previewClipStartMs = previewClip?.startMs;
  useEffect(() => {
    if (previewClipId === undefined || previewClipStartMs === undefined) return;
    seekTo(previewClipStartMs);
    // We intentionally do not autoplay; the user opts in.
  }, [previewClipId, previewClipStartMs, seekTo]);

  // Stop at the clip's out-point during playback.
  useEffect(() => {
    if (!previewClip) return;
    if (!playing) return;
    if (currentMs >= previewClip.endMs) {
      pause();
      seekTo(previewClip.startMs);
    }
  }, [currentMs, playing, previewClip, pause, seekTo]);

  // Space toggles play/pause when the editor surface has focus. We listen
  // on window so the binding works while focus is on the timeline too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      // Don't steal Space from form fields.
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // Local time = where we are inside the clip's window.
  const localMs = previewClip
    ? Math.min(
        Math.max(0, currentMs - previewClip.startMs),
        Math.max(0, previewClip.endMs - previewClip.startMs),
      )
    : 0;
  const clipDurationMs = previewClip
    ? Math.max(0, previewClip.endMs - previewClip.startMs)
    : 0;

  // Clicking another clip in the list updates `previewClipId`. Render that
  // change here so the user has feedback.
  const previewIdx = previewClip
    ? state.spec.clips.findIndex((c) => c.id === previewClip.id)
    : -1;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div
          className="relative overflow-hidden rounded-xl border border-border/60 bg-black"
          style={{ aspectRatio }}
        >
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              poster={poster}
              preload="metadata"
              playsInline
              className="h-full w-full bg-black"
              onClick={toggle}
            />
          ) : (
            <div
              role="img"
              aria-label="Video unavailable in preview"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_center,oklch(1_0_0/0.05),transparent_70%)] text-zinc-400"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 backdrop-blur-sm">
                <Play className="size-5 translate-x-px" aria-hidden />
              </div>
              <p className="px-6 text-center text-xs leading-relaxed">
                Video URL unavailable in preview mode
                <br />
                <span className="text-zinc-500">
                  Timeline is fully interactive; render to see the cut.
                </span>
              </p>
            </div>
          )}

          {/* Subtle scrim over the playhead time so it stays readable on
              bright frames. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center justify-between gap-3 font-mono text-[11px] text-white/85 tabular-nums">
            <span>{formatTimecode(localMs)}</span>
            <span className="text-white/55">
              {formatTimecode(clipDurationMs)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  aria-label={playing ? "Pause" : "Play"}
                  onClick={toggle}
                  disabled={!videoUrl}
                />
              }
            >
              {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            </TooltipTrigger>
            <TooltipContent>
              {playing ? "Pause (Space)" : "Play (Space)"}
            </TooltipContent>
          </Tooltip>

          <div className="min-w-0 flex-1">
            <ClipScrubber
              localMs={localMs}
              durationMs={clipDurationMs}
              onSeek={(ms) => {
                if (!previewClip) return;
                seekTo(previewClip.startMs + ms);
              }}
            />
          </div>

          <div className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
            {formatTimecode(localMs)}
            <span className="px-1.5 text-muted-foreground/60">/</span>
            {formatTimecode(clipDurationMs)}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <p className="truncate">
            <span className="text-muted-foreground/70">Previewing</span>{" "}
            <span className="text-foreground">
              {previewClip?.label ?? "—"}
            </span>
            {previewIdx >= 0 ? (
              <span className="ml-1.5 text-muted-foreground/60">
                ({previewIdx + 1}/{state.spec.clips.length})
              </span>
            ) : null}
          </p>
          {state.spec.clips.length > 1 ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => {
                  if (previewIdx > 0) {
                    setPreviewClip(state.spec.clips[previewIdx - 1].id);
                  }
                }}
                disabled={previewIdx <= 0}
              >
                Prev clip
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => {
                  if (previewIdx >= 0 && previewIdx < state.spec.clips.length - 1) {
                    setPreviewClip(state.spec.clips[previewIdx + 1].id);
                  }
                }}
                disabled={
                  previewIdx < 0 || previewIdx >= state.spec.clips.length - 1
                }
              >
                Next clip
              </Button>
            </div>
          ) : null}
        </div>

        <p className="rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Preview only plays the selected clip. Render to see the full
          composition.
        </p>
      </div>
    </TooltipProvider>
  );
}

interface ClipScrubberProps {
  localMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
}

function ClipScrubber({ localMs, durationMs, onSeek }: ClipScrubberProps) {
  const pct = durationMs > 0 ? Math.min(100, (localMs / durationMs) * 100) : 0;

  return (
    <div
      role="slider"
      aria-label="Seek within preview clip"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, durationMs)}
      aria-valuenow={localMs}
      tabIndex={0}
      onKeyDown={(e) => {
        if (durationMs <= 0) return;
        const step = e.shiftKey ? 1000 : 100;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onSeek(Math.max(0, localMs - step));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onSeek(Math.min(durationMs, localMs + step));
        }
      }}
      className={cn(
        "group relative h-7 w-full cursor-pointer rounded-md outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      onClick={(e) => {
        if (durationMs <= 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, x / rect.width));
        onSeek(ratio * durationMs);
      }}
    >
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border/70" />
      <div
        className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-foreground/85 transition-[width] duration-75"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm ring-2 ring-background transition-[left] duration-75"
        style={{ left: `${pct}%` }}
        aria-hidden
      />
    </div>
  );
}

"use client";

import { useMemo } from "react";

import { formatTimecode } from "@/lib/client/edit-spec";
import { cn } from "@/lib/utils";

interface TimelineRulerProps {
  totalMs: number;
  className?: string;
}

interface TickConfig {
  /** ms between minor ticks */
  minorMs: number;
  /** ms between labeled major ticks */
  majorMs: number;
}

function tickConfig(totalMs: number): TickConfig {
  // Sensible buckets so dense edits don't drown in ticks. Brief calls for
  // 1s/5s/30s buckets at 1m/5m/30m thresholds — extend gracefully past 30m.
  if (totalMs < 60_000) return { minorMs: 1_000, majorMs: 5_000 };
  if (totalMs < 5 * 60_000) return { minorMs: 5_000, majorMs: 30_000 };
  if (totalMs < 30 * 60_000) return { minorMs: 30_000, majorMs: 60_000 };
  return { minorMs: 60_000, majorMs: 5 * 60_000 };
}

/** Compact label for ruler ticks ("0:30", "1:00", "1:30:00"). */
function rulerLabel(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/**
 * The thin tick row above the timeline track. Render-cheap: ticks are
 * absolutely positioned by percent so the parent's width can change
 * without recalculating anything here.
 */
export function TimelineRuler({ totalMs, className }: TimelineRulerProps) {
  const { minorTicks, majorTicks } = useMemo(() => {
    const { minorMs, majorMs } = tickConfig(totalMs);
    const minor: number[] = [];
    const major: number[] = [];
    if (totalMs <= 0) return { minorTicks: minor, majorTicks: major };
    for (let t = 0; t <= totalMs; t += minorMs) minor.push(t);
    for (let t = 0; t <= totalMs; t += majorMs) major.push(t);
    return { minorTicks: minor, majorTicks: major };
  }, [totalMs]);

  return (
    <div
      className={cn("relative h-7 w-full select-none", className)}
      aria-hidden
      role="presentation"
      title={`Timeline · ${formatTimecode(totalMs)}`}
    >
      {minorTicks.map((t) => {
        const pct = totalMs > 0 ? (t / totalMs) * 100 : 0;
        return (
          <span
            key={`min-${t}`}
            className="absolute bottom-0 h-1.5 w-px bg-border/80"
            style={{ left: `${pct}%` }}
          />
        );
      })}
      {majorTicks.map((t) => {
        const pct = totalMs > 0 ? (t / totalMs) * 100 : 0;
        return (
          <span
            key={`maj-${t}`}
            className="absolute bottom-0 flex flex-col items-center gap-0.5"
            style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
          >
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {rulerLabel(t)}
            </span>
            <span className="h-2 w-px bg-foreground/35" />
          </span>
        );
      })}
    </div>
  );
}

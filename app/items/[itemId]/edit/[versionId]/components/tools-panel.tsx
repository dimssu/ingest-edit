"use client";

import { useMemo, useState } from "react";
import { Plus, Scissors, Square, SquareDashed, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatTimecode,
  totalDurationMs,
  type EditSpecClip,
} from "@/lib/client/edit-spec";
import type { VersionSummary } from "@/types/api";

import { useEditSpec } from "../hooks/use-edit-spec";
import { AppendDialog } from "./append-dialog";

interface ToolsPanelProps {
  /** Other versions on this item (for the Append picker). */
  versions: VersionSummary[];
  /** Currently focused version, excluded from the Append picker. */
  focusedVersionId: string;
}

/**
 * The verbs of the editor. Each button is a single, predictable action and
 * the block above describes the current selection so users always know
 * what's about to happen.
 */
export function ToolsPanel({ versions, focusedVersionId }: ToolsPanelProps) {
  const {
    state,
    split,
    removeRange,
    setInPoint,
    setOutPoint,
    clearMarks,
    appendClip,
  } = useEditSpec();

  const totalMs = useMemo(() => totalDurationMs(state.spec), [state.spec]);
  const [appendOpen, setAppendOpen] = useState(false);

  const inMs = state.inMs;
  const outMs = state.outMs;
  const playhead = state.playheadMs;

  const canRemoveRange = inMs !== null && outMs !== null && outMs > inMs;
  const otherVersions = versions.filter(
    (v) => v.versionId !== focusedVersionId,
  );

  const handleAppend = (v: VersionSummary) => {
    const clip: EditSpecClip = {
      id: `clip_${v.versionId}_${Date.now().toString(36)}`,
      sourceVersionId: v.versionId,
      label: v.label,
      sourceDurationMs: v.durationMs,
      startMs: 0,
      endMs: v.durationMs,
    };
    appendClip(clip);
    setAppendOpen(false);
  };

  return (
    <TooltipProvider>
      <section
        aria-label="Editing tools"
        className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-4"
      >
        <header className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tools
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Operate on the global timeline. The playhead and in/out marks
            live in milliseconds.
          </p>
        </header>

        <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-background/60 p-2">
          <Stat label="Playhead" value={formatTimecode(playhead)} />
          <Stat
            label="In"
            value={inMs !== null ? formatTimecode(inMs) : "—"}
            accent={inMs !== null}
          />
          <Stat
            label="Out"
            value={outMs !== null ? formatTimecode(outMs) : "—"}
            accent={outMs !== null}
          />
        </div>

        <div className="space-y-1.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  onClick={() => split(playhead)}
                  className="w-full justify-start"
                />
              }
            >
              <Scissors aria-hidden />
              Split at playhead
            </TooltipTrigger>
            <TooltipContent>
              Cut the clip under the playhead in two.
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Trim range
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="default"
              onClick={() => setInPoint(playhead)}
              className="justify-center"
            >
              <Square aria-hidden />
              Set In
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="default"
              onClick={() => setOutPoint(playhead)}
              className="justify-center"
            >
              <SquareDashed aria-hidden />
              Set Out
            </Button>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="default"
            disabled={!canRemoveRange}
            onClick={() => {
              if (inMs === null || outMs === null) return;
              removeRange(inMs, outMs);
            }}
            className="w-full justify-start"
          >
            <Trash2 aria-hidden />
            Remove range
          </Button>
          {inMs !== null || outMs !== null ? (
            <button
              type="button"
              onClick={clearMarks}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear marks
            </button>
          ) : null}
        </div>

        <Separator />

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Append
          </p>
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => setAppendOpen(true)}
            disabled={otherVersions.length === 0}
            className="w-full justify-start"
          >
            <Plus aria-hidden />
            Append a version
          </Button>
          {otherVersions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No other versions on this item to append from yet.
            </p>
          ) : null}
        </div>

        <AppendDialog
          open={appendOpen}
          onOpenChange={setAppendOpen}
          versions={otherVersions}
          onPick={handleAppend}
        />

        <div className="rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Total spec length:{" "}
          <span className="font-mono tabular-nums text-foreground">
            {formatTimecode(totalMs)}
          </span>
        </div>
      </section>
    </TooltipProvider>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={
          "font-mono text-[11px] tabular-nums " +
          (accent ? "text-amber-600 dark:text-amber-400" : "text-foreground")
        }
      >
        {value}
      </span>
    </div>
  );
}

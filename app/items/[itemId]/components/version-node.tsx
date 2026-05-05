"use client";

import { forwardRef } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDuration, formatRelativeTime } from "@/lib/client/format";
import type { VersionSummary } from "@/types/api";

interface VersionNodeProps {
  version: VersionSummary;
  focused: boolean;
  onFocus: (versionId: string) => void;
}

const OP_LABEL: Record<string, string> = {
  original: "original",
  trim: "trim",
  concat: "concat",
  "audio-swap": "audio-swap",
  "audio-extract": "audio-extract",
  split: "split",
  append: "append",
};

export const VersionNode = forwardRef<HTMLButtonElement, VersionNodeProps>(
  function VersionNode({ version, focused, onFocus }, ref) {
    const op = version.derivedFrom.op;
    const opLabel = OP_LABEL[op] ?? op;

    return (
      <button
        ref={ref}
        type="button"
        data-focused={focused ? "true" : "false"}
        aria-pressed={focused}
        onClick={() => onFocus(version.versionId)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onFocus(version.versionId);
          }
        }}
        className={cn(
          "group/version w-full rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-left transition-all duration-150 ease-out",
          "hover:-translate-y-0.5 hover:border-border hover:bg-card hover:shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          focused &&
            "border-foreground/30 bg-primary/5 ring-2 ring-primary/30 shadow-sm",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Badge
              variant="outline"
              className="h-5 shrink-0 font-mono text-[10px] uppercase tracking-wide"
            >
              {opLabel}
            </Badge>
            <span className="truncate text-sm font-medium text-foreground">
              {version.label}
            </span>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-foreground/80">
            {formatDuration(version.durationMs)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="truncate font-mono text-[10.5px]">
            {version.versionId}
          </span>
          <span className="shrink-0 tabular-nums">
            {formatRelativeTime(version.createdAt)}
          </span>
        </div>
      </button>
    );
  },
);

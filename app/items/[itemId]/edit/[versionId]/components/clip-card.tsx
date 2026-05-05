"use client";

import { ChevronDown, ChevronUp, Eye, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  formatTimecode,
  type EditSpecClip,
} from "@/lib/client/edit-spec";

interface ClipCardProps {
  clip: EditSpecClip;
  index: number;
  totalClips: number;
  /** Where this clip starts on the global timeline. */
  globalStartMs: number;
  globalEndMs: number;
  /** Source-version label for context (often differs from clip.label). */
  sourceLabel: string;
  /** Source-version op badge ("trim", "concat", etc.). */
  sourceOp: string;
  isPreview: boolean;
  onPreview: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

/**
 * Single clip row. Compact, monospaced range labels, with the op badge for
 * non-original sources so the user can spot derivative clips at a glance.
 */
export function ClipCard({
  clip,
  index,
  totalClips,
  globalStartMs,
  globalEndMs,
  sourceLabel,
  sourceOp,
  isPreview,
  onPreview,
  onMoveUp,
  onMoveDown,
  onRemove,
}: ClipCardProps) {
  const showOp = sourceOp && sourceOp !== "original";

  return (
    <TooltipProvider>
      <li
        className={cn(
          "group/card flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 p-2.5 transition-all duration-150",
          "hover:border-foreground/20 hover:bg-card",
          isPreview && "border-foreground/30 bg-primary/5 ring-2 ring-primary/30",
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border/60 bg-background font-mono text-[11px] tabular-nums text-muted-foreground">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            {showOp ? (
              <Badge
                variant="outline"
                className="h-4 shrink-0 font-mono text-[9px] uppercase tracking-wide"
              >
                {sourceOp}
              </Badge>
            ) : null}
            <span className="truncate text-[12.5px] font-medium text-foreground">
              {clip.label}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 font-mono text-[10.5px] text-muted-foreground tabular-nums">
            <span title={`Global ${formatTimecode(globalStartMs)} → ${formatTimecode(globalEndMs)}`}>
              {formatTimecode(globalStartMs)}{" "}
              <span className="text-muted-foreground/50">→</span>{" "}
              {formatTimecode(globalEndMs)}
            </span>
            <span className="truncate text-muted-foreground/70" title={sourceLabel}>
              from {sourceLabel}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant={isPreview ? "default" : "ghost"}
                  size="icon-xs"
                  aria-label={`Preview ${clip.label}`}
                  onClick={onPreview}
                />
              }
            >
              <Eye aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Preview this clip</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move ${clip.label} up`}
                  onClick={onMoveUp}
                  disabled={index === 0}
                />
              }
            >
              <ChevronUp aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Move up</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move ${clip.label} down`}
                  onClick={onMoveDown}
                  disabled={index >= totalClips - 1}
                />
              }
            >
              <ChevronDown aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Move down</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${clip.label}`}
                  onClick={onRemove}
                  disabled={totalClips <= 1}
                />
              }
            >
              <X aria-hidden />
            </TooltipTrigger>
            <TooltipContent>
              {totalClips <= 1 ? "Spec needs at least one clip" : "Remove clip"}
            </TooltipContent>
          </Tooltip>
        </div>
      </li>
    </TooltipProvider>
  );
}

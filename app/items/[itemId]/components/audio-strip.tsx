"use client";

import { Download, Music } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/client/format";
import type { AudioAssetSummary, VersionSummary } from "@/types/api";

interface AudioStripProps {
  assets: AudioAssetSummary[];
  versions: VersionSummary[];
}

export function AudioStrip({ assets, versions }: AudioStripProps) {
  const versionLabelById = new Map(versions.map((v) => [v.versionId, v.label]));

  return (
    <section aria-label="Audio assets" className="space-y-3">
      <header className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Audio assets
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          ({assets.length})
        </span>
      </header>

      {assets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-8 text-center text-sm text-muted-foreground">
          No audio assets yet. Extract from a version or upload your own.
        </p>
      ) : (
        <ScrollArea className="w-full">
          <ul className="flex gap-3 pb-2.5">
            {assets.map((asset) => {
              const sourceLabel = asset.sourceVersionId
                ? versionLabelById.get(asset.sourceVersionId)
                : undefined;
              const label = asset.label ?? "Untitled audio";
              return (
                <li key={asset.assetId} className="shrink-0">
                  <div className="flex w-64 flex-col gap-2 rounded-xl border border-border/60 bg-card/40 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className="h-5 font-mono text-[10px] uppercase tracking-wide"
                      >
                        {asset.format.toUpperCase()}
                      </Badge>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {formatDuration(asset.durationMs)}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <Music
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <p className="truncate text-sm font-medium text-foreground">
                        {label}
                      </p>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {sourceLabel
                        ? `From version: ${sourceLabel}`
                        : "Uploaded"}
                    </p>
                    <div className="pt-1">
                      {asset.audioUrl ? (
                        <a
                          href={asset.audioUrl}
                          download
                          className={cn(
                            buttonVariants({
                              variant: "outline",
                              size: "sm",
                            }),
                            "w-full justify-center",
                          )}
                          aria-label={`Download ${label}`}
                        >
                          <Download aria-hidden />
                          Download
                        </a>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  aria-disabled
                                  disabled
                                  className="w-full justify-center"
                                />
                              }
                            >
                              <Download aria-hidden />
                              Download
                            </TooltipTrigger>
                            <TooltipContent>
                              Audio URL unavailable
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </section>
  );
}

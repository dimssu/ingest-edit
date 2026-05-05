"use client";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDuration } from "@/lib/client/format";
import type { VersionSummary } from "@/types/api";

interface AppendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: VersionSummary[];
  onPick: (version: VersionSummary) => void;
}

/**
 * Picks a version to append to the timeline. Shows the version's op badge,
 * label, and duration so users can confirm the right one without leaving
 * the editor.
 */
export function AppendDialog({
  open,
  onOpenChange,
  versions,
  onPick,
}: AppendDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Append a version</DialogTitle>
          <DialogDescription>
            Pick another version of this item to add to the end of the
            timeline. The new clip uses the version&apos;s full duration.
          </DialogDescription>
        </DialogHeader>

        {versions.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            No other versions are available on this item.
          </p>
        ) : (
          <ScrollArea className="max-h-72">
            <ul className="space-y-1.5 pr-1">
              {versions.map((v) => (
                <li key={v.versionId}>
                  <button
                    type="button"
                    onClick={() => onPick(v)}
                    className="group/picker w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-left transition-all duration-150 hover:-translate-y-px hover:border-foreground/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge
                          variant="outline"
                          className="h-5 shrink-0 font-mono text-[10px] uppercase tracking-wide"
                        >
                          {v.derivedFrom.op}
                        </Badge>
                        <span className="truncate text-sm font-medium text-foreground">
                          {v.label}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatDuration(v.durationMs)}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[10.5px] text-muted-foreground">
                      {v.versionId}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

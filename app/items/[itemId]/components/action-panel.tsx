"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Pencil, Music, Scissors } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/client/format";
import type { VersionSummary } from "@/types/api";

interface ActionPanelProps {
  itemId: string;
  focused: VersionSummary | undefined;
}

export function ActionPanel({ itemId, focused }: ActionPanelProps) {
  const [audioDialog, setAudioDialog] = useState<null | "swap" | "extract">(
    null,
  );

  if (!focused) {
    return (
      <aside className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
        Select a version to see its actions.
      </aside>
    );
  }

  const downloadAvailable = Boolean(focused.videoUrl);
  const editorHref = `/items/${itemId}/edit/${focused.versionId}`;

  return (
    <TooltipProvider>
      <aside
        aria-label="Version actions"
        className="lg:sticky lg:top-6 space-y-5 rounded-xl border border-border/60 bg-card/40 p-5"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="h-5 font-mono text-[10px] uppercase tracking-wide"
            >
              {focused.derivedFrom.op}
            </Badge>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDuration(focused.durationMs)}
            </span>
          </div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {focused.label}
          </h3>
          <p className="font-mono text-[11px] text-muted-foreground">
            {[focused.videoCodec, focused.audioCodec].filter(Boolean).join(" · ") ||
              "—"}
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <Link
            href={editorHref}
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "w-full justify-center",
            )}
          >
            <Pencil aria-hidden />
            Open in editor
          </Link>
          {downloadAvailable ? (
            <a
              href={focused.videoUrl}
              download
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full justify-center",
              )}
            >
              <Download aria-hidden />
              Download video
            </a>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    aria-disabled
                    disabled
                    className="w-full justify-center"
                  />
                }
              >
                <Download aria-hidden />
                Download video
              </TooltipTrigger>
              <TooltipContent>Video URL unavailable</TooltipContent>
            </Tooltip>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Audio
          </p>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => setAudioDialog("swap")}
            className="w-full justify-start"
          >
            <Music aria-hidden />
            Swap audio
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => setAudioDialog("extract")}
            className="w-full justify-start"
          >
            <Scissors aria-hidden />
            Extract audio
          </Button>
        </div>

        <Dialog
          open={audioDialog !== null}
          onOpenChange={(open) => {
            if (!open) setAudioDialog(null);
          }}
        >
          <DialogContent data-phase="7">
            <DialogHeader>
              <DialogTitle>
                {audioDialog === "swap" ? "Swap audio" : "Extract audio"}
              </DialogTitle>
              <DialogDescription>
                {audioDialog === "swap"
                  ? "Audio swap is coming soon. Pick from existing assets or upload new audio."
                  : "Extract audio from this version. Coming soon."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Close
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </aside>
    </TooltipProvider>
  );
}

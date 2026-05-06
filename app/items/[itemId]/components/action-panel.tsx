"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Download, Music, Pencil, Scissors } from "lucide-react";

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
import { ApiError, postAudioExtract, postAudioSwap } from "@/lib/client/api";
import type { AudioAssetSummary, VersionSummary } from "@/types/api";

import { JobProgressPill } from "./job-progress-pill";

interface PendingJob {
  jobId: string;
  kind: "swap" | "extract";
  label: string;
}

interface ActionPanelProps {
  itemId: string;
  focused: VersionSummary | undefined;
  audioAssets: AudioAssetSummary[];
  /** Called when a swap/extract job lands `succeeded`. `versionId` is set
   *  when the job produced a new Version (swap); undefined for extract. */
  onJobComplete: (versionId?: string) => void;
}

export function ActionPanel({
  itemId,
  focused,
  audioAssets,
  onJobComplete,
}: ActionPanelProps) {
  const swapDescriptionId = useId();
  const extractDescriptionId = useId();

  const [audioDialog, setAudioDialog] = useState<null | "swap" | "extract">(
    null,
  );
  const [pickedAssetId, setPickedAssetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PendingJob | null>(null);

  if (!focused) {
    return (
      <aside className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
        Select a version to see its actions.
      </aside>
    );
  }

  const downloadAvailable = Boolean(focused.videoUrl);
  const editorHref = `/items/${itemId}/edit/${focused.versionId}`;
  const audioBusy = pending !== null;

  const closeAudioDialog = () => {
    setAudioDialog(null);
    setPickedAssetId(null);
  };

  const submitSwap = async () => {
    if (!pickedAssetId || submitting) return;
    setSubmitting(true);
    try {
      const res = await postAudioSwap({
        itemId,
        versionId: focused.versionId,
        audioAssetId: pickedAssetId,
      });
      const asset = audioAssets.find((a) => a.assetId === pickedAssetId);
      const assetLabel = asset?.label ?? "audio";
      setPending({
        jobId: res.jobId,
        kind: "swap",
        label: `Swapping audio · ${assetLabel}`,
      });
      toast.success("Swap started", {
        description: "We’ll update the canvas when it lands.",
      });
      closeAudioDialog();
    } catch (err: unknown) {
      const isApi = err instanceof ApiError;
      const description =
        isApi || err instanceof Error ? err.message : "Unexpected error.";
      toast.error("Couldn’t start audio swap", { description });
    } finally {
      setSubmitting(false);
    }
  };

  const submitExtract = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await postAudioExtract({
        itemId,
        versionId: focused.versionId,
      });
      setPending({
        jobId: res.jobId,
        kind: "extract",
        label: `Extracting audio · ${focused.label}`,
      });
      toast.success("Extract started", {
        description: "We’ll update the audio strip when it lands.",
      });
      closeAudioDialog();
    } catch (err: unknown) {
      const isApi = err instanceof ApiError;
      const description =
        isApi || err instanceof Error ? err.message : "Unexpected error.";
      toast.error("Couldn’t start audio extract", { description });
    } finally {
      setSubmitting(false);
    }
  };

  const audioBusyExplanation = audioBusy
    ? `${pending?.kind === "swap" ? "Audio swap" : "Audio extract"} is in progress.`
    : null;

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
          {audioBusy ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    disabled
                    aria-disabled
                    className="w-full justify-start"
                  />
                }
              >
                <Music aria-hidden />
                Swap audio
              </TooltipTrigger>
              <TooltipContent>{audioBusyExplanation}</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setAudioDialog("swap")}
              className="w-full justify-start"
              aria-label="Swap audio on this version"
            >
              <Music aria-hidden />
              Swap audio
            </Button>
          )}
          {audioBusy ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    disabled
                    aria-disabled
                    className="w-full justify-start"
                  />
                }
              >
                <Scissors aria-hidden />
                Extract audio
              </TooltipTrigger>
              <TooltipContent>{audioBusyExplanation}</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setAudioDialog("extract")}
              className="w-full justify-start"
              aria-label="Extract audio from this version"
            >
              <Scissors aria-hidden />
              Extract audio
            </Button>
          )}
        </div>

        {pending ? (
          <JobProgressPill
            jobId={pending.jobId}
            label={pending.label}
            onComplete={(result) => {
              const versionId =
                typeof result?.versionId === "string"
                  ? result.versionId
                  : undefined;
              if (pending.kind === "swap") {
                toast.success("Audio swapped", {
                  description: "A new version is ready.",
                });
              } else {
                toast.success("Audio extracted", {
                  description: "Find it in the audio strip below.",
                });
              }
              onJobComplete(versionId);
            }}
            onError={(message) => {
              toast.error(
                pending.kind === "swap"
                  ? "Audio swap failed"
                  : "Audio extract failed",
                { description: message },
              );
            }}
            onDismiss={() => setPending(null)}
          />
        ) : null}

        {/* Swap dialog — picks an existing AudioAsset. */}
        <Dialog
          open={audioDialog === "swap"}
          onOpenChange={(open) => {
            if (!open) closeAudioDialog();
          }}
        >
          <DialogContent
            data-phase="8a"
            aria-describedby={swapDescriptionId}
            className="sm:max-w-md"
          >
            <DialogHeader>
              <DialogTitle>Swap audio</DialogTitle>
              <DialogDescription id={swapDescriptionId}>
                Replace the audio on{" "}
                <span className="font-medium text-foreground">
                  {focused.label}
                </span>{" "}
                with one of this item’s audio assets. A new version is created;
                the original stays untouched.
              </DialogDescription>
            </DialogHeader>

            {audioAssets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                No audio assets yet. Extract audio from a version first to
                build a library you can swap in.
              </div>
            ) : (
              <ul
                role="radiogroup"
                aria-label="Choose an audio asset"
                className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1"
              >
                {audioAssets.map((asset) => {
                  const selected = pickedAssetId === asset.assetId;
                  return (
                    <li key={asset.assetId}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPickedAssetId(asset.assetId)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                          selected
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/60 bg-card/40 hover:bg-muted/40",
                        )}
                      >
                        <Music
                          aria-hidden
                          className={cn(
                            "size-4 shrink-0",
                            selected ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {asset.label ?? "Untitled audio"}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            <span className="font-mono uppercase tracking-wide">
                              {asset.format}
                            </span>{" "}
                            · {formatDuration(asset.durationMs)}
                          </p>
                        </div>
                        {selected ? (
                          <Badge
                            variant="secondary"
                            className="h-5 text-[10px] uppercase tracking-wide"
                          >
                            Picked
                          </Badge>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="button"
                onClick={() => void submitSwap()}
                disabled={
                  submitting ||
                  audioAssets.length === 0 ||
                  pickedAssetId === null
                }
              >
                {submitting ? "Starting…" : "Swap"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Extract dialog — confirmation only. */}
        <Dialog
          open={audioDialog === "extract"}
          onOpenChange={(open) => {
            if (!open) closeAudioDialog();
          }}
        >
          <DialogContent
            data-phase="8a"
            aria-describedby={extractDescriptionId}
            className="sm:max-w-md"
          >
            <DialogHeader>
              <DialogTitle>Extract audio?</DialogTitle>
              <DialogDescription id={extractDescriptionId}>
                Pull the audio off{" "}
                <span className="font-medium text-foreground">
                  {focused.label}
                </span>{" "}
                into a new asset you can swap onto another version. The
                original version stays untouched.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="button"
                onClick={() => void submitExtract()}
                disabled={submitting}
              >
                {submitting ? "Starting…" : "Extract"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </aside>
    </TooltipProvider>
  );
}

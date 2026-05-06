"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Play, Sparkles } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ApiError, postRender, type RenderRequest } from "@/lib/client/api";
import { totalDurationMs, validateSpec } from "@/lib/client/edit-spec";

import { useEditSpec } from "../hooks/use-edit-spec";

interface EditorHeaderProps {
  itemId: string;
  versionLabel: string;
  versionId: string;
  /** True while a render is in flight — disables the render button so a
   *  second submit can't race the first. */
  rendering: boolean;
  /** Called when /api/render returns 202 with a `jobId`. The shell mounts
   *  the overlay and subscribes to the job from there. */
  onRenderEnqueued: (jobId: string) => void;
}

/**
 * Top bar: back-to-canvas affordance, focused-version breadcrumb, and the
 * Render call-to-action. The button hands the spec to /api/render and
 * lifts the resulting `jobId` to the editor shell, which owns the
 * rendering overlay so the overlay survives header re-renders.
 */
export function EditorHeader({
  itemId,
  versionLabel,
  versionId,
  rendering,
  onRenderEnqueued,
}: EditorHeaderProps) {
  const { state } = useEditSpec();
  const [submitting, setSubmitting] = useState(false);

  const totalMs = totalDurationMs(state.spec);
  const validation = validateSpec(state.spec);
  const buttonBusy = submitting || rendering;

  const handleRender = async () => {
    if (buttonBusy) return;
    if (!validation.ok) {
      toast.error("Spec is invalid", {
        description: validation.reason,
      });
      return;
    }
    const req: RenderRequest = {
      itemId,
      baseVersionId: state.spec.baseVersionId,
      clips: state.spec.clips.map((c) => ({
        sourceVersionId: c.sourceVersionId,
        startMs: c.startMs,
        endMs: c.endMs,
      })),
    };
    setSubmitting(true);
    try {
      const res = await postRender(req);
      onRenderEnqueued(res.jobId);
    } catch (err: unknown) {
      const isApi = err instanceof ApiError;
      const description = isApi
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unexpected error.";
      toast.error("Couldn’t submit render", { description });
    } finally {
      setSubmitting(false);
    }
  };

  const buttonLabel = submitting
    ? "Submitting…"
    : rendering
      ? "Rendering…"
      : "Render";

  const tooltipContent = !validation.ok
    ? validation.reason
    : rendering
      ? "A render is already in progress."
      : "Submit this edit for rendering.";

  return (
    <TooltipProvider>
      <header className="border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-6 py-3.5 md:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href={`/items/${itemId}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "gap-1.5",
              )}
            >
              <ArrowLeft aria-hidden />
              Back to canvas
            </Link>
            <div className="hidden h-5 w-px bg-border md:block" />
            <div className="hidden min-w-0 md:block">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Editing
              </p>
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold tracking-tight text-foreground">
                <Play className="size-3 text-muted-foreground" aria-hidden />
                <span className="truncate">{versionLabel}</span>
                <span className="font-mono text-[11px] font-normal text-muted-foreground">
                  {versionId}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-muted-foreground tabular-nums md:inline">
              {(totalMs / 1000).toFixed(2)}s · {state.spec.clips.length} clip
              {state.spec.clips.length === 1 ? "" : "s"}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="default"
                    size="lg"
                    onClick={() => void handleRender()}
                    disabled={buttonBusy || !validation.ok}
                    aria-label="Render edit"
                  />
                }
              >
                <Sparkles aria-hidden />
                {buttonLabel}
              </TooltipTrigger>
              <TooltipContent>{tooltipContent}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}

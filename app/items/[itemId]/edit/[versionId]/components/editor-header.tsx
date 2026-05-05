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
}

/**
 * Top bar: back-to-canvas affordance, focused-version breadcrumb, and the
 * Render call-to-action. Render is wired end-to-end against the 501 stub
 * so reviewers can verify the request shape — see lib/client/api.ts.
 */
export function EditorHeader({
  itemId,
  versionLabel,
  versionId,
}: EditorHeaderProps) {
  const { state } = useEditSpec();
  const [submitting, setSubmitting] = useState(false);

  const totalMs = totalDurationMs(state.spec);
  const validation = validateSpec(state.spec);

  const handleRender = async () => {
    if (submitting) return;
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
      toast.success("Spec accepted", {
        description: `Render coming in next release · job ${res.jobId}`,
      });
    } catch (err: unknown) {
      const isApi = err instanceof ApiError;
      // 501 from the stub is the EXPECTED path — surface it calmly.
      if (isApi && err.code === "RENDER_NOT_IMPLEMENTED") {
        toast.info("Spec accepted", {
          description: "Render is wired but no executor yet — coming next release.",
        });
      } else {
        const msg =
          err instanceof Error ? err.message : "Unexpected error.";
        toast.error("Couldn’t submit render", { description: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

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
                    disabled={submitting || !validation.ok}
                    aria-label="Render edit"
                  />
                }
              >
                <Sparkles aria-hidden />
                {submitting ? "Submitting…" : "Render"}
              </TooltipTrigger>
              <TooltipContent>
                Render is wired but no executor yet — Phase 7.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}

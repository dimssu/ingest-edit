"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { JobProgressPill } from "@/app/items/[itemId]/components/job-progress-pill";

interface RenderingOverlayProps {
  itemId: string;
  jobId: string;
  /** Called on terminal `failed` so the editor can restore. The parent is
   *  also responsible for unmounting the overlay (clears `pendingJobId`). */
  onFailed: (message: string) => void;
  /** Called when the user dismisses the overlay locally — the server-side
   *  render keeps going, the editor is restored, the user can either
   *  retry or check the dashboard. */
  onCancel: () => void;
}

/**
 * Modal-flavored overlay that takes over the editor while a render is in
 * flight. Traps focus, listens for ESC, and routes to the canvas focused
 * on the new version once the job lands.
 *
 * The "Cancel" button is a UX escape hatch only — there's no abort API.
 */
export function RenderingOverlay({
  itemId,
  jobId,
  onFailed,
  onCancel,
}: RenderingOverlayProps) {
  const router = useRouter();
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Initial focus on the cancel button so keyboard users land somewhere
  // sensible. Body scroll is locked while rendering.
  useEffect(() => {
    cancelButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Trap focus inside the overlay so Tab cycles through interactive
  // children only.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const root = overlayRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  const handleCancel = () => {
    toast.info("Render still running", {
      description:
        "The render will keep going in the background — check the dashboard.",
    });
    onCancel();
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="render-overlay-title"
      aria-describedby="render-overlay-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
    >
      <div className="mx-4 w-full max-w-md rounded-xl border border-border/60 bg-card p-6 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Sparkles
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Rendering
            </p>
          </div>
          <h2
            id="render-overlay-title"
            className="font-heading text-lg font-semibold tracking-tight text-foreground"
          >
            Stitching your edit together
          </h2>
          <p
            id="render-overlay-desc"
            className="text-sm text-muted-foreground"
          >
            We’ll drop you on the new version as soon as it’s ready.
          </p>
        </div>

        <div className="mt-5">
          <JobProgressPill
            jobId={jobId}
            label="Rendering edit"
            onComplete={(result) => {
              const versionId =
                typeof result?.versionId === "string"
                  ? result.versionId
                  : undefined;
              toast.success("Render complete", {
                description: versionId
                  ? "Opening the new version on the canvas."
                  : "Heading back to the canvas.",
              });
              const target = versionId
                ? `/items/${itemId}?focusVersion=${encodeURIComponent(versionId)}`
                : `/items/${itemId}`;
              router.push(target);
            }}
            onError={(message) => {
              onFailed(message);
            }}
          />
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="ghost"
            onClick={handleCancel}
            aria-label="Dismiss render overlay (the render keeps running in the background)"
          >
            <X aria-hidden />
            Hide
          </Button>
        </div>
      </div>
    </div>
  );
}

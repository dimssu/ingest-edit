"use client";

import { ExternalLink, Play } from "lucide-react";

import { formatDuration, formatRelativeTime, truncateMiddle } from "@/lib/client/format";
import type { ItemDetail } from "@/types/api";

interface SourceRailProps {
  item: ItemDetail;
}

function formatBytes(bytes: number | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }
  if (bytes < 1024) return `${bytes} B`;
  const KB = bytes / 1024;
  if (KB < 1024) return `${KB.toFixed(1)} KB`;
  const MB = KB / 1024;
  if (MB < 1024) return `${MB.toFixed(1)} MB`;
  const GB = MB / 1024;
  return `${GB.toFixed(2)} GB`;
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right text-foreground tabular-nums">
        {children}
      </dd>
    </div>
  );
}

export function SourceRail({ item }: SourceRailProps) {
  const dimensions =
    item.width && item.height ? `${item.width}×${item.height}` : "—";
  const framerate =
    typeof item.framerate === "number" && Number.isFinite(item.framerate)
      ? `${item.framerate.toFixed(2)} fps`
      : "—";

  return (
    <aside aria-label="Source video" className="space-y-5">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-muted">
        {item.videoUrl ? (
          <video
            controls
            preload="metadata"
            src={item.videoUrl}
            poster={item.thumbnailUrl}
            className="h-full w-full bg-black"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_center,oklch(var(--muted-foreground)/0.08),transparent_70%)]"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-sm backdrop-blur-sm">
              <Play className="size-4 translate-x-px" aria-hidden />
            </div>
            <p className="text-xs text-muted-foreground">
              Video unavailable in preview
            </p>
          </div>
        )}
      </div>

      <dl className="space-y-2.5 rounded-xl border border-border/60 bg-card/40 p-4">
        <MetaRow label="Source">
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-foreground hover:underline underline-offset-4"
          >
            <span className="truncate">{truncateMiddle(item.sourceUrl, 32)}</span>
            <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          </a>
        </MetaRow>
        <MetaRow label="Duration">{formatDuration(item.durationMs)}</MetaRow>
        <MetaRow label="Dimensions">{dimensions}</MetaRow>
        <MetaRow label="Video codec">
          <span className="font-mono text-[0.78rem]">{item.videoCodec || "—"}</span>
        </MetaRow>
        <MetaRow label="Audio codec">
          <span className="font-mono text-[0.78rem]">
            {item.audioCodec || "—"}
          </span>
        </MetaRow>
        <MetaRow label="Framerate">{framerate}</MetaRow>
        <MetaRow label="File size">{formatBytes(item.fileSizeBytes)}</MetaRow>
        <MetaRow label="Ingested">
          <span title={new Date(item.createdAt).toLocaleString()}>
            {formatRelativeTime(item.createdAt)}
          </span>
        </MetaRow>
      </dl>
    </aside>
  );
}

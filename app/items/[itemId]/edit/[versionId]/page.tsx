import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

interface EditorPlaceholderPageProps {
  params: Promise<{ itemId: string; versionId: string }>;
}

export const metadata: Metadata = {
  title: "Editor · ingest-edit",
};

/**
 * Placeholder for the timeline editor (built in Phase 6). Lives here so
 * the canvas's "Open in editor" CTA never 404s while the real editor is
 * in progress.
 */
export default async function EditorPlaceholderPage({
  params,
}: EditorPlaceholderPageProps) {
  const { itemId, versionId } = await params;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 md:px-12">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            ingest-edit
          </Link>
          <Link
            href={`/items/${itemId}`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to canvas
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1400px] flex-col items-start gap-3 px-6 py-20 md:px-12 md:py-28">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Loading editor
        </p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Timeline editor
        </h1>
        <p className="max-w-prose pt-1 text-sm text-muted-foreground">
          Editing version{" "}
          <span className="font-mono text-foreground">{versionId}</span> from
          item <span className="font-mono text-foreground">{itemId}</span>. The
          full timeline experience is on its way.
        </p>
        <div className="pt-6">
          <Link
            href={`/items/${itemId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Return to canvas
          </Link>
        </div>
      </main>
    </div>
  );
}

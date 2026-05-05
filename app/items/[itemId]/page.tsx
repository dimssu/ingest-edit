import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

interface ItemPlaceholderPageProps {
  params: Promise<{ itemId: string }>;
}

/**
 * Placeholder for the item canvas (built out in Phase 5). Lives here so
 * the dashboard's item cards and the jobs tray's "View item" buttons
 * never 404 while the real workspace is in progress.
 */
export default async function ItemPlaceholderPage({
  params,
}: ItemPlaceholderPageProps) {
  const { itemId } = await params;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4 md:px-12">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            ingest-edit
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-6 py-20 md:px-12 md:py-28">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Item
        </p>
        <h1 className="font-mono text-base text-foreground">{itemId}</h1>
        <p className="max-w-prose pt-2 text-sm text-muted-foreground">
          The canvas for this item is coming soon. You’ll be able to inspect
          versions, edit, swap audio, and download from here.
        </p>
        <div className="pt-6">
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Return to dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}

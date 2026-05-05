import type { Metadata } from "next";
import Link from "next/link";

import { CanvasShell } from "@/app/items/[itemId]/components/canvas-shell";
import { SwrBootstrap } from "@/app/items/[itemId]/components/swr-bootstrap";
import { fakeDataEnabled } from "@/lib/client/fake-data-flag";
import type { ItemDetailResponse } from "@/types/api";

interface ItemCanvasPageProps {
  params: Promise<{ itemId: string }>;
}

export const metadata: Metadata = {
  title: "Canvas · ingest-edit",
};

export const dynamic = "force-dynamic";

/**
 * Server shell for the per-item canvas. When fake-data mode is on we seed
 * SWR's cache so the populated workspace is in the initial HTML; otherwise
 * we render the shell and let SWR fetch + show its loading/error UI.
 *
 * The mock module is dynamic-imported so it never enters the prod bundle.
 */
export default async function ItemCanvasPage({ params }: ItemCanvasPageProps) {
  const { itemId } = await params;

  let initialDetail: ItemDetailResponse | undefined;
  if (fakeDataEnabled()) {
    try {
      const { fakeItemDetailFor } = await import("@/lib/client/mock-data");
      initialDetail = fakeItemDetailFor(itemId);
    } catch {
      // Unknown id — let the client error UI handle it after refetch.
      initialDetail = undefined;
    }
  }

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
            href="/dashboard"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-6 pb-24 pt-10 md:px-12 md:pt-12">
        <SwrBootstrap itemId={itemId} initialDetail={initialDetail}>
          <CanvasShell itemId={itemId} />
        </SwrBootstrap>
      </main>
    </div>
  );
}

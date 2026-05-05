import type { Metadata } from "next";
import Link from "next/link";

import { Toaster } from "@/components/ui/sonner";
import { IngestForm } from "@/app/dashboard/components/ingest-form";
import { IngestJobsTray } from "@/app/dashboard/components/ingest-jobs-tray";
import { ItemsGrid } from "@/app/dashboard/components/items-grid";
import { JobsProvider } from "@/app/dashboard/components/jobs-context";
import { SwrBootstrap } from "@/app/dashboard/components/swr-bootstrap";
import { fakeDataEnabled } from "@/lib/client/fake-data-flag";
import type { ItemListResponse } from "@/types/api";

export const metadata: Metadata = {
  title: "Dashboard · ingest-edit",
  description: "Ingest, edit, and ship videos.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Server-side: when fake-data mode is on, seed SWR's cache so the
  // populated dashboard renders in the initial HTML. In real mode we let
  // the client fetch and pass through the loading skeletons → real data
  // (or the calm error state if the API isn't configured yet).
  // Mock module is dynamically imported so it never enters the prod bundle.
  let initialItems: ItemListResponse | undefined;
  if (fakeDataEnabled()) {
    const { fakeItemList } = await import("@/lib/client/mock-data");
    initialItems = { items: [...fakeItemList.items] };
  }

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
        </div>
      </header>

      <SwrBootstrap initialItems={initialItems}>
        <JobsProvider>
          <main className="mx-auto max-w-[1200px] px-6 pb-24 md:px-12">
            <section className="space-y-3 pt-12 md:pt-16">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Ingest a video
              </h2>
              <p className="text-sm text-muted-foreground">
                Drop in an Instagram link and we’ll grab the source so you can edit it.
              </p>
              <div className="pt-3">
                <IngestForm />
              </div>
            </section>

            <div className="pt-10 md:pt-12">
              <IngestJobsTray />
            </div>

            <section className="pt-12 md:pt-16">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-lg font-semibold tracking-tight">Your items</h3>
              </div>
              <div className="pt-5">
                <ItemsGrid />
              </div>
            </section>
          </main>
        </JobsProvider>
      </SwrBootstrap>

      <Toaster position="bottom-right" />
    </div>
  );
}

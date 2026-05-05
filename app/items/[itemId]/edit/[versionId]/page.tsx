import type { Metadata } from "next";

import { SwrBootstrap } from "@/app/items/[itemId]/components/swr-bootstrap";
import { EditorShell } from "@/app/items/[itemId]/edit/[versionId]/components/editor-shell";
import { fakeDataEnabled } from "@/lib/client/fake-data-flag";
import type { ItemDetailResponse } from "@/types/api";

interface EditorPageProps {
  params: Promise<{ itemId: string; versionId: string }>;
}

export const metadata: Metadata = {
  title: "Editor · ingest-edit",
};

export const dynamic = "force-dynamic";

/**
 * Server entry for the timeline editor. Mirrors the canvas page: when fake
 * data is enabled we seed SWR's cache with the seeded item so the editor
 * paints fully populated on first byte. The real editor experience lives
 * inside `EditorShell`.
 */
export default async function EditorPage({ params }: EditorPageProps) {
  const { itemId, versionId } = await params;

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
    <SwrBootstrap itemId={itemId} initialDetail={initialDetail}>
      <EditorShell itemId={itemId} versionId={versionId} />
    </SwrBootstrap>
  );
}

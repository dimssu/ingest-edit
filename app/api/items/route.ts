import { Item, type ItemDoc } from "@/lib/db/models";
import { bootServer } from "@/lib/server/bootstrap";
import { env } from "@/lib/server/env";
import { errorResponse, jsonResponse } from "@/lib/server/http";
import { child } from "@/lib/server/logger";
import { getSignedReadUrl } from "@/lib/storage/s3";
import { ItemListResponse, type ItemSummary } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const log = child({ route: "items.list" });

/**
 * Resolves a thumbnail key into a presigned URL. Failures are logged and
 * surfaced as `undefined` so one bad key doesn't tank the whole list — but
 * a misconfigured presigner won't go silent.
 */
async function safeSignedUrl(key: string | undefined): Promise<string | undefined> {
  if (!key) return undefined;
  try {
    return await getSignedReadUrl(key);
  } catch (err: unknown) {
    log.warn({ err, key }, "Failed to presign S3 read URL");
    return undefined;
  }
}

/**
 * GET /api/items
 *
 * Lists the user's items, most-recent first, capped at `DEFAULT_LIMIT`.
 * Each item carries a presigned thumbnail URL when available.
 *
 * Pagination is wired through the `nextCursor` field on the response but
 * not yet emitted — the client cap is the practical limit until we
 * exceed it.
 */
export async function GET(): Promise<Response> {
  try {
    await bootServer();

    const docs: ItemDoc[] = await Item.find({ userId: env.APP_USER_ID })
      .sort({ createdAt: -1 })
      .limit(DEFAULT_LIMIT)
      .lean<ItemDoc[]>();

    const items: ItemSummary[] = await Promise.all(
      docs.map(async (d) => ({
        itemId: d.itemId,
        sourceUrl: d.sourceUrl,
        sourcePlatform: d.sourcePlatform,
        thumbnailUrl: await safeSignedUrl(d.thumbnailKey),
        durationMs: d.durationMs,
        width: d.width,
        height: d.height,
        createdAt: d.createdAt.toISOString(),
      })),
    );

    const body: ItemListResponse = { items };
    return jsonResponse(body);
  } catch (err: unknown) {
    return errorResponse(err);
  }
}

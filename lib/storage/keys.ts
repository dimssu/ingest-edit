/**
 * Pure helpers for S3 object keys. Format is fixed by the backend contract:
 *   originals/{userId}/{itemId}/source.{ext}
 *   versions/{userId}/{itemId}/{versionId}.{ext}
 *   audio/{userId}/{itemId}/{assetId}.{ext}
 */

function normalizeExt(ext: string): string {
  const trimmed = ext.startsWith(".") ? ext.slice(1) : ext;
  return trimmed.toLowerCase();
}

export function originalKey(
  userId: string,
  itemId: string,
  ext: string,
): string {
  return `originals/${userId}/${itemId}/source.${normalizeExt(ext)}`;
}

export function versionKey(
  userId: string,
  itemId: string,
  versionId: string,
  ext: string,
): string {
  return `versions/${userId}/${itemId}/${versionId}.${normalizeExt(ext)}`;
}

export function audioKey(
  userId: string,
  itemId: string,
  assetId: string,
  ext: string,
): string {
  return `audio/${userId}/${itemId}/${assetId}.${normalizeExt(ext)}`;
}

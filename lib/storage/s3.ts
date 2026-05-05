import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import { env, requireEnv } from "@/lib/server/env";

let _client: S3Client | null = null;

function getClient(): S3Client {
  requireEnv(
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "S3_BUCKET",
  );
  if (_client) return _client;
  _client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
    },
  });
  return _client;
}

function getBucket(): string {
  requireEnv("S3_BUCKET");
  return env.S3_BUCKET as string;
}

interface UploadStreamOptions {
  key: string;
  body: Readable | Buffer | Uint8Array | string;
  contentType?: string;
  /** S3 multipart part size in bytes (default 8 MiB). */
  partSize?: number;
  /** Cache-Control header to set on the object. */
  cacheControl?: string;
}

/**
 * Uploads a stream/buffer to S3 using the multipart-aware lib-storage `Upload`
 * helper. Multipart kicks in automatically once the body exceeds `partSize`.
 */
export async function uploadStream(opts: UploadStreamOptions): Promise<{
  key: string;
  bucket: string;
  etag: string | undefined;
}> {
  const client = getClient();
  const bucket = getBucket();

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
      CacheControl: opts.cacheControl,
    },
    queueSize: 4,
    partSize: opts.partSize ?? 8 * 1024 * 1024,
    leavePartsOnError: false,
  });

  const result = await upload.done();
  return {
    key: opts.key,
    bucket,
    etag: result.ETag,
  };
}

/**
 * Returns a presigned GET URL for the given key. Use `S3_PUBLIC_BASE_URL` for
 * non-signed CDN delivery when configured by callers; this helper always signs.
 */
export async function getSignedReadUrl(
  key: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  const client = getClient();
  const bucket = getBucket();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, cmd, { expiresIn: expiresInSeconds });
}

export async function deleteObject(key: string): Promise<void> {
  const client = getClient();
  const bucket = getBucket();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

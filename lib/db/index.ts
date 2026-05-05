import mongoose, { type Mongoose } from "mongoose";
import { env, requireEnv } from "@/lib/server/env";
import { logger } from "@/lib/server/logger";

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache =
  globalThis.__mongooseCache ?? { conn: null, promise: null };

if (!globalThis.__mongooseCache) {
  globalThis.__mongooseCache = cache;
}

/**
 * Returns a connected Mongoose instance. Caches on `globalThis` so HMR and
 * repeated route handler invocations reuse the same connection.
 */
export async function connectDB(): Promise<Mongoose> {
  requireEnv("MONGODB_URI", "MONGODB_DB_NAME");

  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const uri = env.MONGODB_URI as string;
    const dbName = env.MONGODB_DB_NAME as string;

    cache.promise = mongoose
      .connect(uri, {
        dbName,
        bufferCommands: false,
      })
      .then((m) => {
        logger.info({ dbName }, "MongoDB connected");
        return m;
      })
      .catch((err: unknown) => {
        cache.promise = null;
        logger.error({ err }, "MongoDB connection failed");
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

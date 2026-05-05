import mongoose, { type Mongoose } from "mongoose";
import { User } from "@/lib/db/models/User";
import { env, requireEnv } from "@/lib/server/env";
import { logger } from "@/lib/server/logger";

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
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
 *
 * On the first successful connection within a process, seeds the single
 * user doc keyed by `APP_USER_ID`. The seed runs best-effort: it is
 * caught and logged so a transient seed failure never blocks the
 * connection from being returned.
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
      .then(async (m) => {
        logger.info({ dbName }, "MongoDB connected");
        try {
          await User.ensureSingleUser(env.APP_USER_ID);
          logger.info(
            { userId: env.APP_USER_ID },
            "Single-user doc ensured",
          );
        } catch (err: unknown) {
          logger.error(
            { err, userId: env.APP_USER_ID },
            "Failed to ensure single-user doc; continuing",
          );
        }
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

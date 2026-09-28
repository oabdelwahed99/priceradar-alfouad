import mongoose from "mongoose";
import { getServerEnv } from "@/lib/env";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = globalThis.__mongooseCache ?? { conn: null, promise: null };
globalThis.__mongooseCache = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const { MONGODB_URI, MONGODB_DB } = getServerEnv();
    cache.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      bufferCommands: false,
      serverSelectionTimeoutMS: 10_000,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

const DATABASE_UNAVAILABLE_PATTERN = /MONGODB_URI|ECONNREFUSED|ServerSelection|querySrv|MongoNetworkError|ETIMEDOUT/i;

/** True for missing configuration or connectivity failures, as opposed to query/programming errors. */
export function isDatabaseUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return DATABASE_UNAVAILABLE_PATTERN.test(`${error.name} ${error.message}`);
}

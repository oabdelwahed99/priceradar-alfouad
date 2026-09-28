import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { PriceObservation, type PriceObservationDoc } from "@/models";
import type { Availability, HistoryRange, ObservationOrigin } from "@/types";

export interface NewObservation {
  workspaceId: string;
  productId: Types.ObjectId | string;
  retailerId: Types.ObjectId | string;
  sourceId: Types.ObjectId | string;
  price: number;
  originalPrice: number | null;
  currency: string | null;
  availability: Availability;
  scrapedAt: Date;
  origin?: ObservationOrigin;
}

/** Observations are append-only; this is the only write path. */
export async function recordObservation(obs: NewObservation): Promise<PriceObservationDoc> {
  await connectToDatabase();
  const doc = await PriceObservation.create(obs);
  return doc.toObject() as PriceObservationDoc;
}

export async function getLatestObservationsBySource(
  sourceIds: (Types.ObjectId | string)[],
): Promise<Map<string, PriceObservationDoc>> {
  await connectToDatabase();
  if (sourceIds.length === 0) return new Map();
  const ids = sourceIds.map((id) => new Types.ObjectId(String(id)));
  const rows = await PriceObservation.aggregate<{ _id: Types.ObjectId; doc: PriceObservationDoc }>([
    { $match: { sourceId: { $in: ids } } },
    { $sort: { sourceId: 1, scrapedAt: -1 } },
    { $group: { _id: "$sourceId", doc: { $first: "$$ROOT" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.doc]));
}

export const HISTORY_RANGE_DAYS: Record<HistoryRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "6m": 182,
  "1y": 365,
};

export type HistoryObservation = Pick<PriceObservationDoc, "_id" | "sourceId" | "scrapedAt" | "price">;

export async function getObservationsSince(productId: string, range: HistoryRange): Promise<HistoryObservation[]> {
  await connectToDatabase();
  const since = new Date(Date.now() - HISTORY_RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
  return PriceObservation.find({ productId, scrapedAt: { $gte: since } }, { sourceId: 1, scrapedAt: 1, price: 1 })
    .sort({ scrapedAt: 1 })
    .lean<HistoryObservation[]>();
}

export async function getRecentObservations(productId: string, limit = 200): Promise<PriceObservationDoc[]> {
  await connectToDatabase();
  return PriceObservation.find({ productId }).sort({ scrapedAt: -1 }).limit(limit).lean<PriceObservationDoc[]>();
}

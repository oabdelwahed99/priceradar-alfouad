import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { assertObjectId } from "@/lib/db/object-id";
import {
  ProductContentSnapshot,
  type ProductContentSnapshotDoc,
  type ProductSourceDoc,
  type RetailerDoc,
} from "@/models";
import type { ProductContentAnalysisDTO } from "@/types/dto";
import { getProductDoc, getProductSources } from "../products/product.service";
import type { PageContent } from "../scraping/types";
import { buildContentAnalysis, type ContentFields, type ContentPageInput } from "./content-analysis";

/** Copy fields that define a content version. Ratings and image counts change often and are updated in place. */
const TRACKED_FIELDS = ["title", "metaDescription", "description", "headings", "bulletPoints", "faqQuestions"] as const;
export type TrackedContentField = (typeof TRACKED_FIELDS)[number];

export function contentHash(content: Pick<PageContent, TrackedContentField>): string {
  const tracked = Object.fromEntries(TRACKED_FIELDS.map((f) => [f, content[f] ?? null]));
  return createHash("sha256").update(JSON.stringify(tracked)).digest("hex");
}

export function changedContentFields(
  previous: Pick<PageContent, TrackedContentField>,
  current: Pick<PageContent, TrackedContentField>,
): TrackedContentField[] {
  return TRACKED_FIELDS.filter((f) => JSON.stringify(previous[f] ?? null) !== JSON.stringify(current[f] ?? null));
}

export interface RecordContentInput {
  workspaceId: string;
  productId: Types.ObjectId | string;
  retailerId: Types.ObjectId | string;
  sourceId: Types.ObjectId | string;
  content: PageContent;
  capturedAt: Date;
}

export type RecordContentResult =
  | { kind: "first" }
  | { kind: "unchanged" }
  | { kind: "changed"; fields: TrackedContentField[]; previousCapturedAt: Date };

/** Inserts a new version when the page copy changed; otherwise refreshes the current version in place. */
export async function recordContentSnapshot(input: RecordContentInput): Promise<RecordContentResult> {
  await connectToDatabase();
  const { content, capturedAt } = input;
  const hash = contentHash(content);
  const latest = await ProductContentSnapshot.findOne({ sourceId: input.sourceId })
    .sort({ capturedAt: -1 })
    .lean<ProductContentSnapshotDoc>();

  if (latest && latest.contentHash === hash) {
    await ProductContentSnapshot.updateOne(
      { _id: latest._id },
      { $set: { lastSeenAt: capturedAt, rating: content.rating, images: content.images, language: content.language } },
    );
    return { kind: "unchanged" };
  }

  await ProductContentSnapshot.create({
    workspaceId: input.workspaceId,
    productId: input.productId,
    retailerId: input.retailerId,
    sourceId: input.sourceId,
    contentHash: hash,
    ...content,
    capturedAt,
    lastSeenAt: capturedAt,
  });

  if (!latest) return { kind: "first" };
  return {
    kind: "changed",
    fields: changedContentFields(toContentFields(latest), content),
    previousCapturedAt: latest.capturedAt,
  };
}

function toContentFields(doc: ProductContentSnapshotDoc): ContentFields {
  return {
    title: doc.title ?? null,
    metaDescription: doc.metaDescription ?? null,
    description: doc.description ?? null,
    headings: {
      h1: doc.headings?.h1 ?? [],
      h2: doc.headings?.h2 ?? [],
      h3: doc.headings?.h3 ?? [],
    },
    bulletPoints: doc.bulletPoints ?? [],
    faqQuestions: doc.faqQuestions ?? [],
    rating: doc.rating ? { value: doc.rating.value ?? null, count: doc.rating.count ?? null } : null,
    images: { total: doc.images?.total ?? 0, withAlt: doc.images?.withAlt ?? 0 },
    language: doc.language ?? null,
  };
}

export type LatestContent = Map<string, { doc: ProductContentSnapshotDoc; versions: number }>;

/** Current content version and version count per source id. */
export async function getLatestContentBySource(sourceIds: Types.ObjectId[]): Promise<LatestContent> {
  if (sourceIds.length === 0) return new Map();
  const rows = await ProductContentSnapshot.aggregate<{ _id: Types.ObjectId; doc: ProductContentSnapshotDoc; versions: number }>([
    { $match: { sourceId: { $in: sourceIds } } },
    { $sort: { sourceId: 1, capturedAt: -1 } },
    { $group: { _id: "$sourceId", doc: { $first: "$$ROOT" }, versions: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { doc: r.doc, versions: r.versions }]));
}

export function toContentPageInput(
  source: Pick<ProductSourceDoc, "_id" | "url" | "isOwnStore">,
  retailer: Pick<RetailerDoc, "name">,
  latest: LatestContent,
): ContentPageInput {
  const entry = latest.get(String(source._id));
  return {
    sourceId: String(source._id),
    retailerName: retailer.name,
    url: source.url,
    isOwnStore: Boolean(source.isOwnStore),
    content: entry ? toContentFields(entry.doc) : null,
    contentSince: entry?.doc.capturedAt ?? null,
    lastSeenAt: entry?.doc.lastSeenAt ?? null,
    versionCount: entry?.versions ?? 0,
  };
}

export async function getProductContentAnalysis(workspaceId: string, productId: string): Promise<ProductContentAnalysisDTO> {
  assertObjectId(productId, "Product");
  await connectToDatabase();
  const [, sources] = await Promise.all([getProductDoc(workspaceId, productId), getProductSources(workspaceId, productId)]);
  const latest = await getLatestContentBySource(sources.map((s) => s.source._id));
  return buildContentAnalysis(sources.map(({ source, retailer }) => toContentPageInput(source, retailer, latest)));
}

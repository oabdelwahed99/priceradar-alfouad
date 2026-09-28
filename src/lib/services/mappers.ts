import type { AnalysisSnapshotDTO, RetailerDTO } from "@/types/dto";
import type { AnalysisSnapshot } from "@/types";
import type { RetailerDoc } from "@/models";

export const toIso = (d: Date | string | null | undefined): string | null =>
  d ? new Date(d).toISOString() : null;

export function toRetailerDTO(r: Pick<RetailerDoc, "_id" | "name" | "domain" | "isOwnStore" | "createdAt">): RetailerDTO {
  return {
    id: String(r._id),
    name: r.name,
    domain: r.domain,
    isOwnStore: Boolean(r.isOwnStore),
    createdAt: toIso(r.createdAt) ?? new Date(0).toISOString(),
  };
}

export function toAnalysisDTO(a: AnalysisSnapshot | null | undefined): AnalysisSnapshotDTO | null {
  if (!a) return null;
  return {
    status: a.status,
    ownPrice: a.ownPrice ?? null,
    currency: a.currency ?? null,
    marketMinimum: a.marketMinimum ?? null,
    marketMaximum: a.marketMaximum ?? null,
    marketAverage: a.marketAverage ?? null,
    marketMedian: a.marketMedian ?? null,
    gapPercentage: a.gapPercentage ?? null,
    position: a.position ?? null,
    suggestedPrice: a.suggestedPrice ?? null,
    competitorCount: a.competitorCount ?? 0,
    successfulCompetitorCount: a.successfulCompetitorCount ?? 0,
    computedAt: toIso(a.computedAt) ?? new Date(0).toISOString(),
  };
}

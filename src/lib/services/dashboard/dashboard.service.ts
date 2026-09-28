import { connectToDatabase } from "@/lib/db/mongoose";
import { Product, Retailer } from "@/models";
import { PRICE_POSITIONS, type PricePosition } from "@/types";
import type { DashboardStatsDTO } from "@/types/dto";
import { countNewAlerts, listAlerts } from "../alerts/alert.service";
import { countSourcesByProduct, toProductListItem, type LeanProduct } from "../products/product.service";

const ATTENTION_LIMIT = 8;
const RECENT_ALERTS_LIMIT = 5;

function emptyPositionCounts(): Record<PricePosition, number> {
  return Object.fromEntries(PRICE_POSITIONS.map((p) => [p, 0])) as Record<PricePosition, number>;
}

export async function getDashboardStats(workspaceId: string): Promise<DashboardStatsDTO> {
  await connectToDatabase();

  const [totalProducts, totalCompetitors, positionRows, attentionDocs, newAlerts, recentAlerts] = await Promise.all([
    Product.countDocuments({ workspaceId }),
    Retailer.countDocuments({ workspaceId, isOwnStore: { $ne: true } }),
    Product.aggregate<{ _id: PricePosition; count: number }>([
      { $match: { workspaceId, "latestAnalysis.status": "OK", "latestAnalysis.position": { $ne: null } } },
      { $group: { _id: "$latestAnalysis.position", count: { $sum: 1 } } },
    ]),
    Product.aggregate<LeanProduct>([
      {
        $match: {
          workspaceId,
          "latestAnalysis.status": "OK",
          "latestAnalysis.position": { $nin: [null, "MARKET_ALIGNED"] },
        },
      },
      { $addFields: { absGap: { $abs: "$latestAnalysis.gapPercentage" } } },
      { $sort: { absGap: -1, _id: 1 } },
      { $limit: ATTENTION_LIMIT },
      { $project: { absGap: 0 } },
    ]),
    countNewAlerts(workspaceId),
    listAlerts(workspaceId, { status: "new", page: 1, pageSize: RECENT_ALERTS_LIMIT }),
  ]);

  const positionCounts = emptyPositionCounts();
  for (const row of positionRows) {
    if (row._id in positionCounts) positionCounts[row._id] = row.count;
  }
  const sourceCounts = await countSourcesByProduct(attentionDocs.map((p) => p._id));

  return {
    totalProducts,
    totalCompetitors,
    productsCompared: Object.values(positionCounts).reduce((a, b) => a + b, 0),
    underpriced: positionCounts.UNDERPRICED + positionCounts.SLIGHTLY_UNDERPRICED,
    overpriced: positionCounts.OVERPRICED + positionCounts.SLIGHTLY_OVERPRICED,
    marketAligned: positionCounts.MARKET_ALIGNED,
    positionCounts,
    newAlerts,
    attention: attentionDocs.map((p) => toProductListItem(p, sourceCounts.get(String(p._id)) ?? 0)),
    recentAlerts: recentAlerts.items,
  };
}

import type { NextRequest } from "next/server";
import { handleRouteError, ok, parseSearchParams } from "@/lib/api/http";
import { getPriceHistory } from "@/lib/services/comparison/comparison.service";
import { historyQuerySchema } from "@/lib/validation/comparison.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/products/[id]/history">) {
  try {
    const { id } = await ctx.params;
    const { range } = parseSearchParams(request, historyQuerySchema);
    return ok(await getPriceHistory(getCurrentWorkspaceId(), id, range));
  } catch (error) {
    return handleRouteError(error);
  }
}

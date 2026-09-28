import type { NextRequest } from "next/server";
import { handleRouteError, ok } from "@/lib/api/http";
import { getComparisonRows } from "@/lib/services/comparison/comparison.service";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/products/[id]/prices">) {
  try {
    const { id } = await ctx.params;
    return ok(await getComparisonRows(getCurrentWorkspaceId(), id));
  } catch (error) {
    return handleRouteError(error);
  }
}

import type { NextRequest } from "next/server";
import { handleRouteError, ok } from "@/lib/api/http";
import { captureProductContent } from "@/lib/services/comparison/comparison.service";
import { getProductContentAnalysis } from "@/lib/services/content/content.service";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const maxDuration = 300;

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/products/[id]/content">) {
  try {
    const { id } = await ctx.params;
    return ok(await getProductContentAnalysis(getCurrentWorkspaceId(), id));
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Captures every source page's copy without recording prices. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/products/[id]/content">) {
  try {
    const { id } = await ctx.params;
    return ok(await captureProductContent(getCurrentWorkspaceId(), id));
  } catch (error) {
    return handleRouteError(error);
  }
}

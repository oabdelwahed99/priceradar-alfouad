import type { NextRequest } from "next/server";
import { handleRouteError, ok, parseOptionalJsonBody } from "@/lib/api/http";
import { compareProduct } from "@/lib/services/comparison/comparison.service";
import { refreshBodySchema } from "@/lib/validation/comparison.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const maxDuration = 300;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/products/[id]/compare">) {
  try {
    const { id } = await ctx.params;
    const { sourceIds } = await parseOptionalJsonBody(request, refreshBodySchema);
    return ok(await compareProduct(getCurrentWorkspaceId(), id, { sourceIds }));
  } catch (error) {
    return handleRouteError(error);
  }
}

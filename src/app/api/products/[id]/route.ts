import type { NextRequest } from "next/server";
import { handleRouteError, ok } from "@/lib/api/http";
import { deleteProduct, getProductDetail } from "@/lib/services/products/product.service";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  try {
    const { id } = await ctx.params;
    return ok(await getProductDetail(getCurrentWorkspaceId(), id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  try {
    const { id } = await ctx.params;
    await deleteProduct(getCurrentWorkspaceId(), id);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

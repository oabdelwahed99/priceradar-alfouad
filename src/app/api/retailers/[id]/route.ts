import type { NextRequest } from "next/server";
import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { deleteRetailer, updateRetailer } from "@/lib/services/retailers/retailer.service";
import { updateRetailerSchema } from "@/lib/validation/retailer.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/retailers/[id]">) {
  try {
    const { id } = await ctx.params;
    const input = await parseJsonBody(request, updateRetailerSchema);
    return ok(await updateRetailer(getCurrentWorkspaceId(), id, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/retailers/[id]">) {
  try {
    const { id } = await ctx.params;
    await deleteRetailer(getCurrentWorkspaceId(), id);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

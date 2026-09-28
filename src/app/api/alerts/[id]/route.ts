import type { NextRequest } from "next/server";
import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { updateAlertStatus } from "@/lib/services/alerts/alert.service";
import { updateAlertSchema } from "@/lib/validation/alert.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/alerts/[id]">) {
  try {
    const { id } = await ctx.params;
    const { status } = await parseJsonBody(request, updateAlertSchema);
    return ok(await updateAlertStatus(getCurrentWorkspaceId(), id, status));
  } catch (error) {
    return handleRouteError(error);
  }
}

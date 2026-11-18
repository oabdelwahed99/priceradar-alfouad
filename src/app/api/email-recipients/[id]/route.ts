import type { NextRequest } from "next/server";
import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import {
  deleteEmailRecipient,
  updateEmailRecipient,
} from "@/lib/services/email-reports/recipient.service";
import { updateEmailRecipientSchema } from "@/lib/validation/email-report.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/email-recipients/[id]">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const input = await parseJsonBody(request, updateEmailRecipientSchema);
    return ok(await updateEmailRecipient(getCurrentWorkspaceId(), id, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/email-recipients/[id]">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    await deleteEmailRecipient(getCurrentWorkspaceId(), id);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

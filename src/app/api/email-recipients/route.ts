import { created, handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import {
  createEmailRecipient,
  listEmailRecipients,
} from "@/lib/services/email-reports/recipient.service";
import { createEmailRecipientSchema } from "@/lib/validation/email-report.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function GET() {
  try {
    await requireAdmin();
    return ok(await listEmailRecipients(getCurrentWorkspaceId()));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = await parseJsonBody(request, createEmailRecipientSchema);
    return created(await createEmailRecipient(getCurrentWorkspaceId(), input));
  } catch (error) {
    return handleRouteError(error);
  }
}

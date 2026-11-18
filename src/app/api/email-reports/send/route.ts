import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { sendEmailReport } from "@/lib/services/email-reports/email-report.service";
import { emailReportSendSchema } from "@/lib/validation/email-report.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const input = await parseJsonBody(request, emailReportSendSchema);
    return ok(await sendEmailReport(getCurrentWorkspaceId(), session.accountId, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

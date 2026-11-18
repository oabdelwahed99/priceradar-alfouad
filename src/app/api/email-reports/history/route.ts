import { handleRouteError, ok, parseSearchParams } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { listEmailReportHistory } from "@/lib/services/email-reports/email-report.service";
import { emailReportHistoryQuerySchema } from "@/lib/validation/email-report.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const query = parseSearchParams(request, emailReportHistoryQuerySchema);
    return ok(await listEmailReportHistory(getCurrentWorkspaceId(), query));
  } catch (error) {
    return handleRouteError(error);
  }
}

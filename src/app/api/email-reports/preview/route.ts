import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { previewEmailReport } from "@/lib/services/email-reports/email-report.service";
import { emailReportPreviewSchema } from "@/lib/validation/email-report.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = await parseJsonBody(request, emailReportPreviewSchema);
    return ok(await previewEmailReport(getCurrentWorkspaceId(), input));
  } catch (error) {
    return handleRouteError(error);
  }
}

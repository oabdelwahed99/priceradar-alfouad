import { handleRouteError, ok, parseSearchParams } from "@/lib/api/http";
import { listAlerts } from "@/lib/services/alerts/alert.service";
import { listAlertsQuerySchema } from "@/lib/validation/alert.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function GET(request: Request) {
  try {
    const query = parseSearchParams(request, listAlertsQuerySchema);
    return ok(await listAlerts(getCurrentWorkspaceId(), query));
  } catch (error) {
    return handleRouteError(error);
  }
}

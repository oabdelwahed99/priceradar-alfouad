import { handleRouteError, ok } from "@/lib/api/http";
import { markAllAlertsRead } from "@/lib/services/alerts/alert.service";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function POST() {
  try {
    return ok({ updated: await markAllAlertsRead(getCurrentWorkspaceId()) });
  } catch (error) {
    return handleRouteError(error);
  }
}

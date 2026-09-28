import { handleRouteError, ok, parseSearchParams } from "@/lib/api/http";
import { getContentOverview } from "@/lib/services/content/content-overview.service";
import { contentOverviewQuerySchema } from "@/lib/validation/content.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function GET(request: Request) {
  try {
    const query = parseSearchParams(request, contentOverviewQuerySchema);
    return ok(await getContentOverview(getCurrentWorkspaceId(), query));
  } catch (error) {
    return handleRouteError(error);
  }
}

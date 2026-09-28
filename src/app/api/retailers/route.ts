import { created, handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { createRetailer, listRetailersWithStats } from "@/lib/services/retailers/retailer.service";
import { createRetailerSchema } from "@/lib/validation/retailer.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function GET() {
  try {
    return ok(await listRetailersWithStats(getCurrentWorkspaceId()));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, createRetailerSchema);
    return created(await createRetailer(getCurrentWorkspaceId(), input));
  } catch (error) {
    return handleRouteError(error);
  }
}

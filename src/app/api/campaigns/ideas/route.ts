import type { NextRequest } from "next/server";
import { handleRouteError, ok, parseJsonBody } from "@/lib/api/http";
import { requireSession } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/errors";
import { generateCampaignIdeas } from "@/lib/services/reviews/openai-campaign-ideas";
import { getCampaignsOverview } from "@/lib/services/reviews/campaign.service";
import { campaignIdeasBodySchema } from "@/lib/validation/reviews.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "admin") {
      throw new ForbiddenError("Marketing Campaigns is locked for this account.");
    }
    const body = await parseJsonBody(request, campaignIdeasBodySchema);
    const workspaceId = getCurrentWorkspaceId();
    const overview = await getCampaignsOverview(workspaceId, {
      brand: body.brand,
      retailerId: body.retailerId,
    });
    const result = await generateCampaignIdeas(
      overview.insights,
      overview.selectedBrand,
      overview.productAngles,
    );
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

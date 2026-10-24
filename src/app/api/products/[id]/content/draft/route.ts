import type { NextRequest } from "next/server";
import { handleRouteError, ok } from "@/lib/api/http";
import { requireSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getProductContentAnalysis } from "@/lib/services/content/content.service";
import { generateSeoContentDraft } from "@/lib/services/content/openai-seo-draft";
import { getProductDoc } from "@/lib/services/products/product.service";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const maxDuration = 60;

export async function POST(_request: NextRequest, ctx: RouteContext<"/api/products/[id]/content/draft">) {
  try {
    await requireSession();
    const { id } = await ctx.params;
    const workspaceId = getCurrentWorkspaceId();
    const [product, analysis] = await Promise.all([
      getProductDoc(workspaceId, id),
      getProductContentAnalysis(workspaceId, id),
    ]);

    if (product.isDemo) {
      throw new AppError("SEO drafts are not available for demo products.", 400, "DEMO_PRODUCT");
    }

    const result = await generateSeoContentDraft(
      { name: product.name, brand: product.brand ?? null, size: product.size ?? null },
      analysis,
    );
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

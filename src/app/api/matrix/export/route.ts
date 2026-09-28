import { handleRouteError, parseSearchParams } from "@/lib/api/http";
import { getPriceMatrix, priceMatrixToCsv } from "@/lib/services/matrix/price-matrix.service";
import { priceMatrixQuerySchema } from "@/lib/validation/matrix.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function GET(request: Request) {
  try {
    const query = parseSearchParams(request, priceMatrixQuerySchema);
    const matrix = await getPriceMatrix(getCurrentWorkspaceId(), query);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(priceMatrixToCsv(matrix), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="price-matrix-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

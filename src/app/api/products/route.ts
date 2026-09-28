import { created, handleRouteError, ok, parseJsonBody, parseSearchParams } from "@/lib/api/http";
import { createProduct, listProducts } from "@/lib/services/products/product.service";
import { createProductSchema, listProductsQuerySchema } from "@/lib/validation/product.schema";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export async function GET(request: Request) {
  try {
    const query = parseSearchParams(request, listProductsQuerySchema);
    return ok(await listProducts(getCurrentWorkspaceId(), query));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, createProductSchema);
    return created(await createProduct(getCurrentWorkspaceId(), input));
  } catch (error) {
    return handleRouteError(error);
  }
}

import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { assertObjectId } from "@/lib/db/object-id";
import { NotFoundError } from "@/lib/errors";
import type { ListAlertsQuery } from "@/lib/validation/alert.schema";
import { Alert, Product, Retailer, type AlertDoc, type ProductDoc, type RetailerDoc } from "@/models";
import type { AlertStatus, AlertType } from "@/types";
import type { AlertDTO, PaginatedDTO } from "@/types/dto";
import { toIso } from "../mappers";
import type { AlertDraft } from "./alert-rules";

export async function createAlerts(workspaceId: string, productId: string, drafts: AlertDraft[]): Promise<number> {
  if (drafts.length === 0) return 0;
  await connectToDatabase();
  await Alert.insertMany(
    drafts.map((d) => ({
      workspaceId,
      productId: new Types.ObjectId(productId),
      retailerId: d.retailerId ? new Types.ObjectId(d.retailerId) : null,
      sourceId: d.sourceId ? new Types.ObjectId(d.sourceId) : null,
      type: d.type,
      title: d.title,
      message: d.message,
      payload: d.payload,
    })),
  );
  return drafts.length;
}

export async function listAlerts(workspaceId: string, query: ListAlertsQuery): Promise<PaginatedDTO<AlertDTO>> {
  await connectToDatabase();
  const filter: Record<string, unknown> = { workspaceId };
  if (query.status === "active") filter.status = { $ne: "dismissed" };
  else if (query.status !== "all") filter.status = query.status;
  if (query.type) filter.type = query.type;

  const [total, alerts] = await Promise.all([
    Alert.countDocuments(filter),
    Alert.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean<AlertDoc[]>(),
  ]);

  const [products, retailers] = await Promise.all([
    Product.find({ _id: { $in: alerts.map((a) => a.productId) } }, { name: 1 }).lean<Pick<ProductDoc, "_id" | "name">[]>(),
    Retailer.find({ _id: { $in: alerts.flatMap((a) => (a.retailerId ? [a.retailerId] : [])) } }, { name: 1 }).lean<
      Pick<RetailerDoc, "_id" | "name">[]
    >(),
  ]);
  const productNames = new Map(products.map((p) => [String(p._id), p.name]));
  const retailerNames = new Map(retailers.map((r) => [String(r._id), r.name]));

  return {
    items: alerts.map((a) => ({
      id: String(a._id),
      type: a.type as AlertType,
      status: a.status as AlertStatus,
      title: a.title,
      message: a.message,
      productId: String(a.productId),
      productName: productNames.get(String(a.productId)) ?? null,
      retailerName: a.retailerId ? (retailerNames.get(String(a.retailerId)) ?? null) : null,
      payload: (a.payload ?? {}) as Record<string, unknown>,
      createdAt: toIso(a.createdAt)!,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function updateAlertStatus(workspaceId: string, id: string, status: AlertStatus): Promise<{ id: string; status: AlertStatus }> {
  assertObjectId(id, "Alert");
  await connectToDatabase();
  const res = await Alert.updateOne({ _id: id, workspaceId }, { $set: { status } });
  if (res.matchedCount === 0) throw new NotFoundError("Alert");
  return { id, status };
}

export async function markAllAlertsRead(workspaceId: string): Promise<number> {
  await connectToDatabase();
  const res = await Alert.updateMany({ workspaceId, status: "new" }, { $set: { status: "read" } });
  return res.modifiedCount;
}

export async function countNewAlerts(workspaceId: string): Promise<number> {
  await connectToDatabase();
  return Alert.countDocuments({ workspaceId, status: "new" });
}

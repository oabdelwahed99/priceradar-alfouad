import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { ALERT_STATUSES, ALERT_TYPES } from "@/types";

const ALERT_RETENTION_SECONDS = 60 * 60 * 24 * 180;

const alertSchema = new Schema(
  {
    workspaceId: { type: String, required: true },
    type: { type: String, enum: ALERT_TYPES, required: true },
    status: { type: String, enum: ALERT_STATUSES, default: "new" },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    retailerId: { type: Schema.Types.ObjectId, ref: "Retailer", default: null },
    sourceId: { type: Schema.Types.ObjectId, ref: "ProductSource", default: null },
    title: { type: String, required: true },
    message: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);

alertSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
alertSchema.index({ createdAt: 1 }, { expireAfterSeconds: ALERT_RETENTION_SECONDS });

export type AlertDoc = InferSchemaType<typeof alertSchema> & { _id: Types.ObjectId };

export const Alert: Model<AlertDoc> =
  (models.Alert as Model<AlertDoc>) || model<AlertDoc>("Alert", alertSchema);

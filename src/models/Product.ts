import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { PRICE_POSITIONS } from "@/types";

const analysisSnapshotSchema = new Schema(
  {
    status: { type: String, enum: ["OK", "INSUFFICIENT_DATA"], required: true },
    ownPrice: { type: Number, default: null },
    currency: { type: String, default: null },
    marketMinimum: { type: Number, default: null },
    marketMaximum: { type: Number, default: null },
    marketAverage: { type: Number, default: null },
    marketMedian: { type: Number, default: null },
    gapPercentage: { type: Number, default: null },
    position: { type: String, enum: [...PRICE_POSITIONS, null], default: null },
    suggestedPrice: { type: Number, default: null },
    competitorCount: { type: Number, default: 0 },
    successfulCompetitorCount: { type: Number, default: 0 },
    computedAt: { type: Date, required: true },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    brand: { type: String, trim: true, maxlength: 120, default: null },
    category: { type: String, trim: true, maxlength: 120, default: null },
    size: { type: String, trim: true, maxlength: 60, default: null },
    currency: { type: String, uppercase: true, minlength: 3, maxlength: 3, default: null },
    imageUrl: { type: String, default: null },
    lastCheckedAt: { type: Date, default: null },
    latestAnalysis: { type: analysisSnapshotSchema, default: null },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

productSchema.index({ workspaceId: 1, name: 1 });
productSchema.index({ workspaceId: 1, "latestAnalysis.position": 1 });
productSchema.index({ workspaceId: 1, lastCheckedAt: -1 });

export type ProductDoc = InferSchemaType<typeof productSchema> & { _id: Types.ObjectId };

export const Product: Model<ProductDoc> =
  (models.Product as Model<ProductDoc>) || model<ProductDoc>("Product", productSchema);

import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { SCRAPE_ERROR_CODES, SCRAPING_STATUSES } from "@/types";

const productSourceSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    retailerId: { type: Schema.Types.ObjectId, ref: "Retailer", required: true, index: true },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    isOwnStore: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    lastScrapedAt: { type: Date, default: null },
    scrapingStatus: { type: String, enum: SCRAPING_STATUSES, default: "pending" },
    lastError: { type: String, default: null },
    lastErrorCode: { type: String, enum: [...SCRAPE_ERROR_CODES, null], default: null },
  },
  { timestamps: true },
);

productSourceSchema.index({ productId: 1, url: 1 }, { unique: true });

export type ProductSourceDoc = InferSchemaType<typeof productSourceSchema> & {
  _id: Types.ObjectId;
};

export const ProductSource: Model<ProductSourceDoc> =
  (models.ProductSource as Model<ProductSourceDoc>) ||
  model<ProductSourceDoc>("ProductSource", productSourceSchema);

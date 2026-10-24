import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/**
 * One document per distinct customer review seen on a product source page.
 * Deduplicated by `{ sourceId, hash }`; new sightings do not create versions.
 */
const productReviewSchema = new Schema(
  {
    workspaceId: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    retailerId: { type: Schema.Types.ObjectId, ref: "Retailer", required: true },
    sourceId: { type: Schema.Types.ObjectId, ref: "ProductSource", required: true },
    hash: { type: String, required: true },
    author: { type: String, default: null },
    rating: { type: Number, default: null },
    text: { type: String, required: true },
    language: { type: String, default: null },
    publishedAt: { type: Date, default: null },
    firstSeenAt: { type: Date, required: true },
  },
  { versionKey: false },
);

productReviewSchema.index({ sourceId: 1, hash: 1 }, { unique: true });
productReviewSchema.index({ workspaceId: 1, retailerId: 1 });
productReviewSchema.index({ workspaceId: 1, productId: 1 });
productReviewSchema.index({ workspaceId: 1, firstSeenAt: -1 });

export type ProductReviewDoc = InferSchemaType<typeof productReviewSchema> & {
  _id: Types.ObjectId;
};

export const ProductReview: Model<ProductReviewDoc> =
  (models.ProductReview as Model<ProductReviewDoc>) ||
  model<ProductReviewDoc>("ProductReview", productReviewSchema);

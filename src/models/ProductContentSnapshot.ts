import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/**
 * One document per distinct version of a source page's copy. A new version is inserted only when
 * `contentHash` changes; otherwise `lastSeenAt` is bumped, so the collection doubles as change history.
 */
const productContentSnapshotSchema = new Schema(
  {
    workspaceId: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    retailerId: { type: Schema.Types.ObjectId, ref: "Retailer", required: true },
    sourceId: { type: Schema.Types.ObjectId, ref: "ProductSource", required: true },
    contentHash: { type: String, required: true },
    title: { type: String, default: null },
    metaDescription: { type: String, default: null },
    description: { type: String, default: null },
    headings: {
      h1: { type: [String], default: [] },
      h2: { type: [String], default: [] },
      h3: { type: [String], default: [] },
    },
    bulletPoints: { type: [String], default: [] },
    faqQuestions: { type: [String], default: [] },
    rating: {
      type: new Schema({ value: { type: Number, default: null }, count: { type: Number, default: null } }, { _id: false }),
      default: null,
    },
    images: {
      total: { type: Number, default: 0 },
      withAlt: { type: Number, default: 0 },
    },
    language: { type: String, default: null },
    capturedAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
  },
  { versionKey: false },
);

productContentSnapshotSchema.index({ sourceId: 1, capturedAt: -1 });
productContentSnapshotSchema.index({ productId: 1 });

export type ProductContentSnapshotDoc = InferSchemaType<typeof productContentSnapshotSchema> & {
  _id: Types.ObjectId;
};

export const ProductContentSnapshot: Model<ProductContentSnapshotDoc> =
  (models.ProductContentSnapshot as Model<ProductContentSnapshotDoc>) ||
  model<ProductContentSnapshotDoc>("ProductContentSnapshot", productContentSnapshotSchema);

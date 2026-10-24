import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

const brandSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
    officialDomain: { type: String, required: true, lowercase: true, trim: true, maxlength: 253 },
    /** Focus brand shown first on the Brands page and dashboard. */
    isFocus: { type: Boolean, default: false },
  },
  { timestamps: true },
);

brandSchema.index({ workspaceId: 1, slug: 1 }, { unique: true });

export type BrandDoc = InferSchemaType<typeof brandSchema> & { _id: Types.ObjectId };

export const Brand: Model<BrandDoc> = (models.Brand as Model<BrandDoc>) || model<BrandDoc>("Brand", brandSchema);

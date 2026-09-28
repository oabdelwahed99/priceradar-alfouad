import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

const retailerSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    domain: { type: String, required: true, lowercase: true, trim: true, maxlength: 253 },
    isOwnStore: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

retailerSchema.index({ workspaceId: 1, domain: 1 }, { unique: true });

export type RetailerDoc = InferSchemaType<typeof retailerSchema> & { _id: Types.ObjectId };

export const Retailer: Model<RetailerDoc> =
  (models.Retailer as Model<RetailerDoc>) || model<RetailerDoc>("Retailer", retailerSchema);

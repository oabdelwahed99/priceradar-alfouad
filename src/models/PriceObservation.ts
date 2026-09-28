import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { AVAILABILITY_VALUES, OBSERVATION_ORIGINS } from "@/types";

/** Append-only: observations are never updated or overwritten. */
const priceObservationSchema = new Schema(
  {
    workspaceId: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    retailerId: { type: Schema.Types.ObjectId, ref: "Retailer", required: true },
    sourceId: { type: Schema.Types.ObjectId, ref: "ProductSource", required: true },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, default: null },
    currency: { type: String, uppercase: true, default: null },
    availability: { type: String, enum: AVAILABILITY_VALUES, default: "unknown" },
    scrapedAt: { type: Date, required: true, default: () => new Date() },
    origin: { type: String, enum: OBSERVATION_ORIGINS, default: "scrape" },
    isDemo: { type: Boolean, default: false },
  },
  { versionKey: false },
);

priceObservationSchema.index({ productId: 1, scrapedAt: -1 });
priceObservationSchema.index({ sourceId: 1, scrapedAt: -1 });
priceObservationSchema.index({ retailerId: 1, scrapedAt: -1 });

export type PriceObservationDoc = InferSchemaType<typeof priceObservationSchema> & {
  _id: Types.ObjectId;
};

export const PriceObservation: Model<PriceObservationDoc> =
  (models.PriceObservation as Model<PriceObservationDoc>) ||
  model<PriceObservationDoc>("PriceObservation", priceObservationSchema);

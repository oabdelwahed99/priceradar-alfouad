import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { EMAIL_TEAMS } from "@/types";

const emailRecipientSchema = new Schema(
  {
    workspaceId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    team: { type: String, enum: EMAIL_TEAMS, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

emailRecipientSchema.index({ workspaceId: 1, email: 1 }, { unique: true });
emailRecipientSchema.index({ workspaceId: 1, team: 1, isActive: 1 });

export type EmailRecipientDoc = InferSchemaType<typeof emailRecipientSchema> & { _id: Types.ObjectId };

export const EmailRecipient: Model<EmailRecipientDoc> =
  (models.EmailRecipient as Model<EmailRecipientDoc>) ||
  model<EmailRecipientDoc>("EmailRecipient", emailRecipientSchema);

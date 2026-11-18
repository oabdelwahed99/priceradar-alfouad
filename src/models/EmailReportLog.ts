import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { EMAIL_REPORT_AUDIENCES, EMAIL_REPORT_PERIOD_DAYS, EMAIL_SEND_STATUSES } from "@/types";

const EMAIL_REPORT_LOG_RETENTION_SECONDS = 60 * 60 * 24 * 365;

const emailSendResultSchema = new Schema(
  {
    email: { type: String, required: true },
    status: { type: String, enum: EMAIL_SEND_STATUSES, required: true },
    providerMessageId: { type: String, default: null },
    error: { type: String, default: null },
  },
  { _id: false },
);

const emailReportLogSchema = new Schema(
  {
    workspaceId: { type: String, required: true },
    sentBy: { type: String, required: true },
    subject: { type: String, required: true, maxlength: 300 },
    audience: { type: String, enum: EMAIL_REPORT_AUDIENCES, required: true },
    periodDays: { type: Number, enum: EMAIL_REPORT_PERIOD_DAYS, required: true },
    results: { type: [emailSendResultSchema], default: [] },
    /** KPI values at send time, so the next report can show "since last report" changes. */
    kpiSnapshot: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);

emailReportLogSchema.index({ workspaceId: 1, createdAt: -1 });
emailReportLogSchema.index({ workspaceId: 1, audience: 1, createdAt: -1 });
emailReportLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: EMAIL_REPORT_LOG_RETENTION_SECONDS });

export type EmailReportLogDoc = InferSchemaType<typeof emailReportLogSchema> & { _id: Types.ObjectId };

export const EmailReportLog: Model<EmailReportLogDoc> =
  (models.EmailReportLog as Model<EmailReportLogDoc>) ||
  model<EmailReportLogDoc>("EmailReportLog", emailReportLogSchema);

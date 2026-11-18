import { z } from "zod";
import { EMAIL_REPORT_AUDIENCES, EMAIL_REPORT_PERIOD_DAYS, EMAIL_SEND_AUDIENCES, EMAIL_TEAMS } from "@/types";
import { objectIdSchema } from "./common";

const recipientNameSchema = z
  .string({ error: "Name is required" })
  .trim()
  .min(1, "Name is required")
  .max(120, "Name must be at most 120 characters");

const recipientEmailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254, "Email must be at most 254 characters");

export const createEmailRecipientSchema = z.object({
  name: recipientNameSchema,
  email: recipientEmailSchema,
  team: z.enum(EMAIL_TEAMS, { error: `Team must be one of: ${EMAIL_TEAMS.join(", ")}` }),
  isActive: z.boolean().optional().default(true),
});

export const updateEmailRecipientSchema = z
  .object({
    name: recipientNameSchema.optional(),
    email: recipientEmailSchema.optional(),
    team: z.enum(EMAIL_TEAMS).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

const periodDaysSchema = z.coerce
  .number()
  .refine(
    (value): value is (typeof EMAIL_REPORT_PERIOD_DAYS)[number] =>
      (EMAIL_REPORT_PERIOD_DAYS as readonly number[]).includes(value),
    { message: `Period must be one of: ${EMAIL_REPORT_PERIOD_DAYS.join(", ")}` },
  )
  .default(7);

const noteSchema = z
  .string()
  .trim()
  .max(500, "Note must be at most 500 characters")
  .optional()
  .transform((value) => (value ? value : undefined));

/** Preview renders one concrete report. "auto" only exists for sending. */
export const emailReportPreviewSchema = z.object({
  audience: z.enum(EMAIL_REPORT_AUDIENCES).default("ceo"),
  periodDays: periodDaysSchema,
  note: noteSchema,
  /** Used for the greeting so the preview reads like the real email. */
  recipientName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const MAX_EMAIL_RECIPIENTS_PER_SEND = 25;

export const emailReportSendSchema = z.object({
  /** "auto" sends each recipient the report written for their own team. */
  audience: z.enum(EMAIL_SEND_AUDIENCES).default("auto"),
  periodDays: periodDaysSchema,
  note: noteSchema,
  recipientIds: z
    .array(objectIdSchema)
    .min(1, "Select at least one recipient")
    .max(MAX_EMAIL_RECIPIENTS_PER_SEND, `Select at most ${MAX_EMAIL_RECIPIENTS_PER_SEND} recipients`),
});

export const emailReportHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateEmailRecipientInput = z.infer<typeof createEmailRecipientSchema>;
export type UpdateEmailRecipientInput = z.infer<typeof updateEmailRecipientSchema>;
export type EmailReportPreviewInput = z.infer<typeof emailReportPreviewSchema>;
export type EmailReportSendInput = z.infer<typeof emailReportSendSchema>;
export type EmailReportHistoryQuery = z.infer<typeof emailReportHistoryQuerySchema>;

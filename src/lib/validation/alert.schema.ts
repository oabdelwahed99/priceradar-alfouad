import { z } from "zod";
import { ALERT_STATUSES, ALERT_TYPES } from "@/types";

/** "active" = everything not dismissed; "all" = no status filter. */
export const ALERT_STATUS_FILTERS = ["active", ...ALERT_STATUSES, "all"] as const;
export type AlertStatusFilter = (typeof ALERT_STATUS_FILTERS)[number];

export const listAlertsQuerySchema = z.object({
  status: z.enum(ALERT_STATUS_FILTERS).default("active"),
  type: z.enum(ALERT_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateAlertSchema = z.object({
  status: z.enum(ALERT_STATUSES, { error: `Status must be one of: ${ALERT_STATUSES.join(", ")}` }),
});

export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;

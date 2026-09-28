import { z } from "zod";
import { HISTORY_RANGES } from "@/types";
import { MAX_COMPETITORS, objectIdSchema } from "./common";

export const refreshBodySchema = z
  .object({
    sourceIds: z.array(objectIdSchema).min(1).max(MAX_COMPETITORS + 1).optional(),
  })
  .default({});

export const historyQuerySchema = z.object({
  range: z.enum(HISTORY_RANGES).default("30d"),
});

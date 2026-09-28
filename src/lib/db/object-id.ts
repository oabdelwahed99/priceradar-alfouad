import { Types } from "mongoose";
import { NotFoundError } from "@/lib/errors";

/** Malformed ids can never match a document, so they are reported as "not found". */
export function assertObjectId(id: string, resource: string): void {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError(resource);
}

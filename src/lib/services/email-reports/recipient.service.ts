import { connectToDatabase } from "@/lib/db/mongoose";
import { assertObjectId } from "@/lib/db/object-id";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { toIso } from "@/lib/services/mappers";
import type {
  CreateEmailRecipientInput,
  UpdateEmailRecipientInput,
} from "@/lib/validation/email-report.schema";
import { EmailRecipient, type EmailRecipientDoc } from "@/models";
import type { EmailTeam } from "@/types";
import type { EmailRecipientDTO } from "@/types/dto";

function toRecipientDTO(doc: EmailRecipientDoc): EmailRecipientDTO {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    team: doc.team as EmailTeam,
    isActive: Boolean(doc.isActive),
    createdAt: toIso(doc.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(doc.updatedAt) ?? new Date(0).toISOString(),
  };
}

export async function listEmailRecipients(workspaceId: string): Promise<EmailRecipientDTO[]> {
  await connectToDatabase();
  const docs = await EmailRecipient.find({ workspaceId })
    .sort({ team: 1, name: 1 })
    .lean<EmailRecipientDoc[]>();
  return docs.map(toRecipientDTO);
}

export async function createEmailRecipient(
  workspaceId: string,
  input: CreateEmailRecipientInput,
): Promise<EmailRecipientDTO> {
  await connectToDatabase();
  const email = input.email.toLowerCase();
  const existing = await EmailRecipient.exists({ workspaceId, email });
  if (existing) throw new ConflictError(`A recipient with ${email} already exists`);

  const doc = await EmailRecipient.create({
    workspaceId,
    name: input.name,
    email,
    team: input.team,
    isActive: input.isActive ?? true,
  });
  return toRecipientDTO(doc.toObject() as EmailRecipientDoc);
}

export async function updateEmailRecipient(
  workspaceId: string,
  id: string,
  input: UpdateEmailRecipientInput,
): Promise<EmailRecipientDTO> {
  assertObjectId(id, "Email recipient");
  await connectToDatabase();

  if (input.email) {
    const email = input.email.toLowerCase();
    const duplicate = await EmailRecipient.exists({
      workspaceId,
      email,
      _id: { $ne: id },
    });
    if (duplicate) throw new ConflictError(`A recipient with ${email} already exists`);
  }

  const $set: Record<string, unknown> = {};
  if (input.name !== undefined) $set.name = input.name;
  if (input.email !== undefined) $set.email = input.email.toLowerCase();
  if (input.team !== undefined) $set.team = input.team;
  if (input.isActive !== undefined) $set.isActive = input.isActive;

  const doc = await EmailRecipient.findOneAndUpdate(
    { _id: id, workspaceId },
    { $set },
    { returnDocument: "after" },
  ).lean<EmailRecipientDoc>();
  if (!doc) throw new NotFoundError("Email recipient");
  return toRecipientDTO(doc);
}

export async function deleteEmailRecipient(workspaceId: string, id: string): Promise<void> {
  assertObjectId(id, "Email recipient");
  await connectToDatabase();
  const res = await EmailRecipient.deleteOne({ _id: id, workspaceId });
  if (res.deletedCount === 0) throw new NotFoundError("Email recipient");
}

export async function getEmailRecipientsByIds(
  workspaceId: string,
  ids: string[],
): Promise<EmailRecipientDTO[]> {
  for (const id of ids) assertObjectId(id, "Email recipient");
  await connectToDatabase();
  const docs = await EmailRecipient.find({
    workspaceId,
    _id: { $in: ids },
    isActive: true,
  }).lean<EmailRecipientDoc[]>();
  return docs.map(toRecipientDTO);
}

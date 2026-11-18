import { connectToDatabase } from "@/lib/db/mongoose";
import { ValidationError } from "@/lib/errors";
import {
  assertEmailConfigured,
  assertVerifiedBrevoSender,
  getEmailTransport,
} from "@/lib/services/email/brevo-transport";
import { toIso } from "@/lib/services/mappers";
import type {
  EmailReportHistoryQuery,
  EmailReportPreviewInput,
  EmailReportSendInput,
} from "@/lib/validation/email-report.schema";
import { EmailReportLog, type EmailReportLogDoc } from "@/models";
import type { EmailReportAudience, EmailReportPeriodDays, EmailSendStatus } from "@/types";
import type {
  EmailPreviewDTO,
  EmailRecipientDTO,
  EmailReportLogDTO,
  EmailSendGroupDTO,
  EmailSendResponseDTO,
  EmailSendResultDTO,
  PaginatedDTO,
} from "@/types/dto";
import { buildExecutiveReport } from "./report-builder";
import { kpisToSnapshot } from "./report-insights";
import { isLocalAppUrl } from "./report-links";
import { renderReportEmail } from "./render-report-email";
import { getEmailRecipientsByIds } from "./recipient.service";

function toLogDTO(doc: EmailReportLogDoc): EmailReportLogDTO {
  const results: EmailSendResultDTO[] = (doc.results ?? []).map((result) => ({
    email: result.email,
    status: result.status as EmailSendStatus,
    providerMessageId: result.providerMessageId ?? null,
    error: result.error ?? null,
  }));
  return {
    id: String(doc._id),
    subject: doc.subject,
    audience: doc.audience as EmailReportAudience,
    periodDays: doc.periodDays as EmailReportPeriodDays,
    sentBy: doc.sentBy,
    results,
    sentCount: results.filter((r) => r.status === "sent").length,
    failedCount: results.filter((r) => r.status === "failed").length,
    createdAt: toIso(doc.createdAt) ?? new Date(0).toISOString(),
  };
}

/** Problems that make the real email less useful. Shown next to the preview. */
export function previewWarnings(appUrl: string | null): string[] {
  if (!appUrl) {
    return [
      "Links are switched off because NEXT_PUBLIC_APP_URL is not set. Set it to your Price Radar address so readers can click through to the details.",
    ];
  }
  if (isLocalAppUrl(appUrl)) {
    return [
      `Links point to ${appUrl}, which only works on this computer. Set NEXT_PUBLIC_APP_URL to your public Price Radar address before sending to other people.`,
    ];
  }
  return [];
}

export async function previewEmailReport(
  workspaceId: string,
  input: EmailReportPreviewInput,
): Promise<EmailPreviewDTO> {
  const report = await buildExecutiveReport(workspaceId, {
    audience: input.audience,
    periodDays: input.periodDays,
    note: input.note,
  });
  const rendered = renderReportEmail(report, { recipientName: input.recipientName });
  return { ...rendered, warnings: previewWarnings(report.appUrl) };
}

/** Groups recipients by the report they should get. "auto" gives each person their own team's report. */
export function groupRecipientsByAudience(
  recipients: EmailRecipientDTO[],
  audience: EmailReportSendInput["audience"],
): Map<EmailReportAudience, EmailRecipientDTO[]> {
  const groups = new Map<EmailReportAudience, EmailRecipientDTO[]>();
  for (const recipient of recipients) {
    const target: EmailReportAudience = audience === "auto" ? recipient.team : audience;
    groups.set(target, [...(groups.get(target) ?? []), recipient]);
  }
  return groups;
}

export async function sendEmailReport(
  workspaceId: string,
  sentBy: string,
  input: EmailReportSendInput,
): Promise<EmailSendResponseDTO> {
  assertEmailConfigured();
  await assertVerifiedBrevoSender();

  const uniqueIds = [...new Set(input.recipientIds)];
  const recipients = await getEmailRecipientsByIds(workspaceId, uniqueIds);
  if (recipients.length === 0) {
    throw new ValidationError("No active recipients matched the selection.");
  }
  if (recipients.length !== uniqueIds.length) {
    throw new ValidationError("One or more recipients are missing or inactive.");
  }

  const transport = getEmailTransport();
  const groups: EmailSendGroupDTO[] = [];
  const allResults: EmailSendResultDTO[] = [];

  for (const [audience, members] of groupRecipientsByAudience(recipients, input.audience)) {
    const report = await buildExecutiveReport(workspaceId, {
      audience,
      periodDays: input.periodDays,
      note: input.note,
    });

    const results: EmailSendResultDTO[] = [];
    let subject = "";
    for (const recipient of members) {
      const rendered = renderReportEmail(report, { recipientName: recipient.name });
      subject = rendered.subject;
      results.push(
        await transport.send({
          to: { email: recipient.email, name: recipient.name },
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }),
      );
    }

    await connectToDatabase();
    const log = await EmailReportLog.create({
      workspaceId,
      sentBy,
      subject,
      audience,
      periodDays: input.periodDays,
      results,
      kpiSnapshot: kpisToSnapshot(report.kpis),
    });

    groups.push({ audience, subject, recipientCount: members.length, logId: String(log._id) });
    allResults.push(...results);
  }

  return { groups, results: allResults };
}

export async function listEmailReportHistory(
  workspaceId: string,
  query: EmailReportHistoryQuery,
): Promise<PaginatedDTO<EmailReportLogDTO>> {
  await connectToDatabase();
  const filter = { workspaceId };
  const [total, docs] = await Promise.all([
    EmailReportLog.countDocuments(filter),
    EmailReportLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean<EmailReportLogDoc[]>(),
  ]);

  return {
    items: docs.map(toLogDTO),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

import type { Metadata } from "next";
import { connection } from "next/server";
import { History, Lock, Mail, Plus, Users } from "lucide-react";
import { RecipientFormDialog } from "@/components/email-reports/recipient-form-dialog";
import { RecipientsTable } from "@/components/email-reports/recipients-table";
import { ReportComposer } from "@/components/email-reports/report-composer";
import { ReportHistoryTable } from "@/components/email-reports/report-history-table";
import { DatabaseNotice } from "@/components/layout/database-notice";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { loadPageData } from "@/lib/db/page-data";
import { isEmailConfigured } from "@/lib/services/email/brevo-env";
import { listEmailReportHistory } from "@/lib/services/email-reports/email-report.service";
import { listEmailRecipients } from "@/lib/services/email-reports/recipient.service";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export const metadata: Metadata = { title: "Email Reports · Price Radar" };

export default async function EmailReportsPage() {
  await connection();
  const session = await getSession();
  if (session?.role !== "admin") {
    return (
      <>
        <PageHeader title="Email Reports" description="This feature is locked for your account." />
        <EmptyState
          icon={Lock}
          title="Email Reports is locked"
          description="Only an admin can manage recipients and send executive report emails."
        />
      </>
    );
  }

  const workspaceId = getCurrentWorkspaceId();
  const emailConfigured = isEmailConfigured();
  const result = await loadPageData(async () => {
    const [recipients, history] = await Promise.all([
      listEmailRecipients(workspaceId),
      listEmailReportHistory(workspaceId, { page: 1, pageSize: 20 }),
    ]);
    return { recipients, history };
  });

  return (
    <>
      <PageHeader
        title="Email Reports"
        description="Send executive summaries of pricing alerts, decisions, and opportunities to CEO, Sales, or Marketing."
        actions={
          result.ok ? (
            <RecipientFormDialog
              trigger={
                <Button>
                  <Plus /> Add recipient
                </Button>
              }
            />
          ) : null
        }
      />

      {!result.ok ? (
        <DatabaseNotice message={result.message} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" /> Recipients
              </CardTitle>
              <CardDescription>People who can receive manual executive report emails.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.data.recipients.length === 0 ? (
                <EmptyState
                  icon={Mail}
                  title="No recipients yet"
                  description="Add CEO, Sales, or Marketing contacts, then preview and send a report."
                  action={
                    <RecipientFormDialog
                      trigger={
                        <Button>
                          <Plus /> Add recipient
                        </Button>
                      }
                    />
                  }
                />
              ) : (
                <RecipientsTable recipients={result.data.recipients} />
              )}
            </CardContent>
          </Card>

          <ReportComposer recipients={result.data.recipients} emailConfigured={emailConfigured} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" /> Send history
              </CardTitle>
              <CardDescription>Recent report sends and per-recipient results.</CardDescription>
            </CardHeader>
            <CardContent>
              {result.data.history.items.length === 0 ? (
                <EmptyState icon={History} title="No sends yet" description="History appears after the first report is sent." />
              ) : (
                <ReportHistoryTable logs={result.data.history.items} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

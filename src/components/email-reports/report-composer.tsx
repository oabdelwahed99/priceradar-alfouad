"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Monitor, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  AUDIENCE_OPTIONS,
  PERIOD_OPTIONS,
  SEND_AUDIENCE_OPTIONS,
  TEAM_LABELS,
} from "@/components/email-reports/team-meta";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { EmailReportAudience, EmailReportPeriodDays, EmailSendAudience, EmailTeam } from "@/types";
import type { EmailPreviewDTO, EmailRecipientDTO, EmailSendResponseDTO } from "@/types/dto";

export function ReportComposer({
  recipients,
  emailConfigured,
}: {
  recipients: EmailRecipientDTO[];
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [audience, setAudience] = useState<EmailSendAudience>("auto");
  const [previewAs, setPreviewAs] = useState<EmailReportAudience>("ceo");
  const [periodDays, setPeriodDays] = useState<EmailReportPeriodDays>(7);
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<EmailPreviewDTO | null>(null);
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "mobile">("desktop");
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activeRecipients = useMemo(() => recipients.filter((r) => r.isActive), [recipients]);
  const selectedRecipients = useMemo(
    () => activeRecipients.filter((r) => selectedIds.includes(r.id)),
    [activeRecipients, selectedIds],
  );

  const previewAudience: EmailReportAudience = audience === "auto" ? previewAs : audience;

  const previewRecipientName = useMemo(() => {
    const match =
      selectedRecipients.find((r) => audience === "auto" && r.team === previewAs) ?? selectedRecipients[0];
    return match?.name;
  }, [selectedRecipients, audience, previewAs]);

  /** What each selected group will receive, for the confirmation dialog. */
  const sendPlan = useMemo(() => {
    const plan = new Map<EmailReportAudience, number>();
    for (const recipient of selectedRecipients) {
      const target: EmailReportAudience = audience === "auto" ? recipient.team : audience;
      plan.set(target, (plan.get(target) ?? 0) + 1);
    }
    return [...plan.entries()];
  }, [selectedRecipients, audience]);

  function toggleRecipient(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function selectTeam(team: EmailTeam) {
    const teamIds = activeRecipients.filter((r) => r.team === team).map((r) => r.id);
    setSelectedIds((prev) => [...new Set([...prev, ...teamIds])]);
  }

  async function onPreview() {
    setPreviewing(true);
    try {
      const data = await apiFetch<EmailPreviewDTO>("/api/email-reports/preview", {
        method: "POST",
        body: JSON.stringify({
          audience: previewAudience,
          periodDays,
          note: note.trim() || undefined,
          recipientName: previewRecipientName,
        }),
      });
      setPreview(data);
      toast.success("Preview ready.");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not build preview.");
    } finally {
      setPreviewing(false);
    }
  }

  async function onSend() {
    setSending(true);
    try {
      const data = await apiFetch<EmailSendResponseDTO>("/api/email-reports/send", {
        method: "POST",
        body: JSON.stringify({
          audience,
          periodDays,
          note: note.trim() || undefined,
          recipientIds: selectedIds,
        }),
      });
      const sent = data.results.filter((r) => r.status === "sent").length;
      const failed = data.results.filter((r) => r.status === "failed").length;
      const groupSummary = data.groups
        .map((group) => `${group.recipientCount} ${AUDIENCE_OPTIONS.find((o) => o.value === group.audience)?.label ?? group.audience}`)
        .join(", ");
      if (failed === 0) toast.success(`Sent to ${sent} recipient${sent === 1 ? "" : "s"} (${groupSummary}).`);
      else toast.warning(`Sent to ${sent}, failed for ${failed}.`);
      for (const result of data.results.filter((r) => r.status === "failed")) {
        toast.error(`${result.email}: ${result.error ?? "Failed"}`);
      }
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not send the report.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compose report</CardTitle>
            <CardDescription>
              Choose the audience and period, preview the email body, then send to selected recipients.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!emailConfigured ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                Email is not configured. Set <code className="font-mono text-xs">BREVO_API_KEY</code>,{" "}
                <code className="font-mono text-xs">EMAIL_FROM_ADDRESS</code>, and{" "}
                <code className="font-mono text-xs">EMAIL_FROM_NAME</code> to send. Preview still works.
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <Select
                  items={SEND_AUDIENCE_OPTIONS}
                  value={audience}
                  onValueChange={(value) => {
                    if (value) setAudience(value as EmailSendAudience);
                    setPreview(null);
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Report audience">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEND_AUDIENCE_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Period</Label>
                <Select
                  items={PERIOD_OPTIONS}
                  value={String(periodDays)}
                  onValueChange={(value) => {
                    if (value) setPeriodDays(Number(value) as EmailReportPeriodDays);
                    setPreview(null);
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Report period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {audience === "auto" ? (
              <div className="space-y-1.5">
                <Label>Preview as</Label>
                <Select
                  items={AUDIENCE_OPTIONS}
                  value={previewAs}
                  onValueChange={(value) => {
                    if (value) setPreviewAs(value as EmailReportAudience);
                    setPreview(null);
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Preview the report written for">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.filter((item) => item.value !== "all").map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Each recipient gets the report written for their own team. Pick a team to check what it will read like.
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="report-note">Optional note</Label>
              <Textarea
                id="report-note"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setPreview(null);
                }}
                placeholder="Short message shown at the top of the email"
                maxLength={500}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Recipients</Label>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(TEAM_LABELS) as EmailTeam[]).map((team) => (
                    <Button key={team} type="button" variant="outline" size="sm" onClick={() => selectTeam(team)}>
                      Select {TEAM_LABELS[team]}
                    </Button>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                    Clear
                  </Button>
                </div>
              </div>
              {activeRecipients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add an active recipient above before sending.</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                  {activeRecipients.map((recipient) => (
                    <li key={recipient.id}>
                      <Label className="flex items-start gap-2 font-normal">
                        <Checkbox
                          checked={selectedIds.includes(recipient.id)}
                          onCheckedChange={() => toggleRecipient(recipient.id)}
                        />
                        <span>
                          <span className="font-medium">{recipient.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {recipient.email} · {TEAM_LABELS[recipient.team]}
                          </span>
                        </span>
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onPreview} disabled={previewing}>
                {previewing ? <Loader2 className="animate-spin" /> : <Eye />}
                Preview email
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!emailConfigured || selectedIds.length === 0 || sending}
              >
                <Send />
                Send email
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email preview</CardTitle>
            <CardDescription>
              {preview
                ? preview.subject
                : "Build a preview to review the HTML body before sending. The send action rebuilds the report on the server."}
            </CardDescription>
            {preview ? (
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={previewWidth === "desktop" ? "default" : "outline"}
                  onClick={() => setPreviewWidth("desktop")}
                >
                  <Monitor /> Desktop
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewWidth === "mobile" ? "default" : "outline"}
                  onClick={() => setPreviewWidth("mobile")}
                >
                  <Smartphone /> Mobile
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3">
            {preview && preview.warnings.length > 0 ? (
              <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            {preview ? (
              <div className="overflow-hidden rounded-md border bg-muted/30 p-3">
                <iframe
                  title="Email preview"
                  sandbox=""
                  srcDoc={preview.html}
                  className="mx-auto h-[560px] w-full rounded-md border bg-white"
                  style={{ maxWidth: previewWidth === "mobile" ? 390 : 640 }}
                />
              </div>
            ) : (
              <div className="flex h-[320px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                No preview yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this report?</AlertDialogTitle>
            <AlertDialogDescription>

              {sendPlan
                .map(
                  ([target, count]) =>
                    `${AUDIENCE_OPTIONS.find((o) => o.value === target)?.label ?? target} brief to ${count} recipient${count === 1 ? "" : "s"}`,
                )
                .join(" · ")}
              <br />
              {selectedRecipients.map((r) => r.email).join(", ")}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onSend} disabled={sending}>
              {sending ? <Loader2 className="animate-spin" /> : <Send />} Send now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

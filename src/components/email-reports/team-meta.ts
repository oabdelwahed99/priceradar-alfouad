import type { EmailReportAudience, EmailSendAudience, EmailTeam } from "@/types";

export const TEAM_LABELS: Record<EmailTeam, string> = {
  ceo: "CEO",
  sales: "Sales",
  marketing: "Marketing",
};

export const AUDIENCE_OPTIONS: { value: EmailReportAudience; label: string }[] = [
  { value: "ceo", label: "CEO" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "all", label: "All teams" },
];

export const SEND_AUDIENCE_OPTIONS: { value: EmailSendAudience; label: string }[] = [
  { value: "auto", label: "Each recipient's own team (recommended)" },
  ...AUDIENCE_OPTIONS,
];

export const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
];

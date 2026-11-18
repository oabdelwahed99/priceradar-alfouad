import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EmailReportLogDTO } from "@/types/dto";
import { formatDateTime } from "@/utils/format";
import { AUDIENCE_OPTIONS } from "./team-meta";

function audienceLabel(audience: EmailReportLogDTO["audience"]): string {
  return AUDIENCE_OPTIONS.find((option) => option.value === audience)?.label ?? audience;
}

export function ReportHistoryTable({ logs }: { logs: EmailReportLogDTO[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Sent</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Audience</TableHead>
          <TableHead>Sender</TableHead>
          <TableHead className="text-right">Results</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
            <TableCell className="max-w-[280px] truncate font-medium" title={log.subject}>
              {log.subject}
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {audienceLabel(log.audience)} · {log.periodDays}d
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{log.sentBy}</TableCell>
            <TableCell className="text-right text-sm">
              <span className="text-emerald-700 dark:text-emerald-400">{log.sentCount} sent</span>
              {log.failedCount > 0 ? (
                <span className="ml-2 text-rose-700 dark:text-rose-400">{log.failedCount} failed</span>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

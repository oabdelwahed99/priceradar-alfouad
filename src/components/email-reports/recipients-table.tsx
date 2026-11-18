"use client";

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { DeleteRecipientButton } from "@/components/email-reports/delete-recipient-button";
import { RecipientFormDialog } from "@/components/email-reports/recipient-form-dialog";
import { TEAM_LABELS } from "@/components/email-reports/team-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import type { EmailRecipientDTO } from "@/types/dto";

export function RecipientsTable({ recipients }: { recipients: EmailRecipientDTO[] }) {
  const router = useRouter();

  async function toggleActive(recipient: EmailRecipientDTO) {
    try {
      await apiFetch(`/api/email-recipients/${recipient.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !recipient.isActive }),
      });
      toast.success(recipient.isActive ? "Recipient deactivated." : "Recipient activated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not update recipient.");
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>Active</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recipients.map((recipient) => (
          <TableRow key={recipient.id}>
            <TableCell className="font-medium">{recipient.name}</TableCell>
            <TableCell className="text-muted-foreground">{recipient.email}</TableCell>
            <TableCell>
              <Badge variant="secondary">{TEAM_LABELS[recipient.team]}</Badge>
            </TableCell>
            <TableCell>
              <Checkbox
                checked={recipient.isActive}
                onCheckedChange={() => toggleActive(recipient)}
                aria-label={`Toggle active for ${recipient.name}`}
              />
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <RecipientFormDialog
                  recipient={recipient}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${recipient.name}`}>
                      <Pencil />
                    </Button>
                  }
                />
                <DeleteRecipientButton recipientId={recipient.id} recipientName={recipient.name} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

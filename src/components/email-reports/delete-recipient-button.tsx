"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiClientError } from "@/lib/api/client";

export function DeleteRecipientButton({
  recipientId,
  recipientName,
}: {
  recipientId: string;
  recipientName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/api/email-recipients/${recipientId}`, { method: "DELETE" });
      toast.success("Recipient deleted.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not delete the recipient.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Delete ${recipientName}`} />}>
        <Trash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {recipientName}?</AlertDialogTitle>
          <AlertDialogDescription>
            They will no longer appear in the recipient list for executive email reports.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete} disabled={deleting}>
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

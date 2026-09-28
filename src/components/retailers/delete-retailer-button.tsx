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

function deleteDescription(retailerName: string, productsMonitored: number, isOwnStore: boolean): string {
  if (productsMonitored === 0) {
    return "It is not used by any product. It will be recreated automatically if you add a product URL on this domain.";
  }
  const products = `${productsMonitored} product${productsMonitored === 1 ? "" : "s"}`;
  if (isOwnStore) {
    return `This is your store. Deleting it removes your price from ${products}, along with this store's URLs, price history, and related alerts. This cannot be undone.`;
  }
  return `This removes ${retailerName} from ${products}, including their store URLs, price history, and related alerts. Products that use it remain, with their price position recalculated. This cannot be undone.`;
}

export function DeleteRetailerButton({
  retailerId,
  retailerName,
  productsMonitored,
  isOwnStore,
}: {
  retailerId: string;
  retailerName: string;
  productsMonitored: number;
  isOwnStore: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/api/retailers/${retailerId}`, { method: "DELETE" });
      toast.success("Retailer deleted.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not delete the retailer.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Delete ${retailerName}`} />}>
        <Trash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {retailerName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteDescription(retailerName, productsMonitored, isOwnStore)}
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

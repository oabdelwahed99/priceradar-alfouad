"use client";

import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { createRetailerSchema, updateRetailerSchema } from "@/lib/validation/retailer.schema";
import type { RetailerDTO } from "@/types/dto";

type FieldErrors = Partial<Record<"name" | "domain", string>>;

export function RetailerFormDialog({ retailer, trigger }: { retailer?: RetailerDTO; trigger: ReactElement }) {
  const router = useRouter();
  const editing = Boolean(retailer);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(retailer?.name ?? "");
  const [domain, setDomain] = useState(retailer?.domain ?? "");
  const [isOwnStore, setIsOwnStore] = useState(retailer?.isOwnStore ?? false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  function onOpenChange(next: boolean) {
    if (next) {
      setName(retailer?.name ?? "");
      setDomain(retailer?.domain ?? "");
      setIsOwnStore(retailer?.isOwnStore ?? false);
      setErrors({});
    }
    setOpen(next);
  }

  function applyFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
    setErrors({ name: fieldErrors.name?.[0], domain: fieldErrors.domain?.[0] });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = editing
      ? updateRetailerSchema.safeParse({ name })
      : createRetailerSchema.safeParse({ name, domain, isOwnStore });
    if (!parsed.success) {
      applyFieldErrors(z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      if (retailer) {
        await apiFetch(`/api/retailers/${retailer.id}`, { method: "PATCH", body: JSON.stringify(parsed.data) });
        toast.success("Retailer updated.");
      } else {
        await apiFetch("/api/retailers", { method: "POST", body: JSON.stringify(parsed.data) });
        toast.success("Retailer added.");
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.body.details?.fieldErrors) applyFieldErrors(error.body.details.fieldErrors);
        else if (error.status === 409) setErrors({ domain: error.message });
        toast.error(error.message);
      } else {
        toast.error("Could not save the retailer.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit retailer" : "Add retailer"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Rename how this retailer appears across products and alerts."
                : "Retailers are also created automatically from product URLs."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="retailer-name">Name</Label>
            <Input
              id="retailer-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="e.g. Store A"
              aria-invalid={Boolean(errors.name)}
              autoFocus
            />
            {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retailer-domain">Domain</Label>
            <Input
              id="retailer-domain"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                setErrors((prev) => ({ ...prev, domain: undefined }));
              }}
              placeholder="store-a.com"
              disabled={editing}
              aria-invalid={Boolean(errors.domain)}
            />
            {errors.domain ? (
              <p className="text-xs text-destructive">{errors.domain}</p>
            ) : editing ? (
              <p className="text-xs text-muted-foreground">The domain identifies the retailer and cannot be changed.</p>
            ) : null}
          </div>

          {editing ? null : (
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox checked={isOwnStore} onCheckedChange={(checked) => setIsOwnStore(checked === true)} />
              This is my own store
            </Label>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {editing ? "Save changes" : "Add retailer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

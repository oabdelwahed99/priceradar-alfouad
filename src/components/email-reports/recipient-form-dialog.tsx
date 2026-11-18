"use client";

import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { TEAM_LABELS } from "@/components/email-reports/team-meta";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import {
  createEmailRecipientSchema,
  updateEmailRecipientSchema,
} from "@/lib/validation/email-report.schema";
import { EMAIL_TEAMS, type EmailTeam } from "@/types";
import type { EmailRecipientDTO } from "@/types/dto";

type FieldErrors = Partial<Record<"name" | "email" | "team", string>>;

const TEAM_ITEMS = EMAIL_TEAMS.map((team) => ({ value: team, label: TEAM_LABELS[team] }));

export function RecipientFormDialog({
  recipient,
  trigger,
}: {
  recipient?: EmailRecipientDTO;
  trigger: ReactElement;
}) {
  const router = useRouter();
  const editing = Boolean(recipient);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(recipient?.name ?? "");
  const [email, setEmail] = useState(recipient?.email ?? "");
  const [team, setTeam] = useState<EmailTeam>(recipient?.team ?? "ceo");
  const [isActive, setIsActive] = useState(recipient?.isActive ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  function onOpenChange(next: boolean) {
    if (next) {
      setName(recipient?.name ?? "");
      setEmail(recipient?.email ?? "");
      setTeam(recipient?.team ?? "ceo");
      setIsActive(recipient?.isActive ?? true);
      setErrors({});
    }
    setOpen(next);
  }

  function applyFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
    setErrors({
      name: fieldErrors.name?.[0],
      email: fieldErrors.email?.[0],
      team: fieldErrors.team?.[0],
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = editing
      ? updateEmailRecipientSchema.safeParse({ name, email, team, isActive })
      : createEmailRecipientSchema.safeParse({ name, email, team, isActive });
    if (!parsed.success) {
      applyFieldErrors(z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      if (recipient) {
        await apiFetch(`/api/email-recipients/${recipient.id}`, {
          method: "PATCH",
          body: JSON.stringify(parsed.data),
        });
        toast.success("Recipient updated.");
      } else {
        await apiFetch("/api/email-recipients", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        toast.success("Recipient added.");
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.body.details?.fieldErrors) applyFieldErrors(error.body.details.fieldErrors);
        else if (error.status === 409) setErrors({ email: error.message });
        toast.error(error.message);
      } else {
        toast.error("Could not save the recipient.");
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
            <DialogTitle>{editing ? "Edit recipient" : "Add recipient"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update who receives executive Price Radar reports."
                : "Add a CEO, Sales, or Marketing contact for report emails."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="recipient-name">Name</Label>
            <Input
              id="recipient-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="e.g. Sara Hassan"
              aria-invalid={Boolean(errors.name)}
              autoFocus
            />
            {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recipient-email">Email</Label>
            <Input
              id="recipient-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="sara@company.com"
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recipient-team">Team</Label>
            <Select
              items={TEAM_ITEMS}
              value={team}
              onValueChange={(value) => {
                if (value) setTeam(value as EmailTeam);
                setErrors((prev) => ({ ...prev, team: undefined }));
              }}
            >
              <SelectTrigger id="recipient-team" className="w-full" aria-invalid={Boolean(errors.team)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.team ? <p className="text-xs text-destructive">{errors.team}</p> : null}
          </div>

          <Label className="flex items-center gap-2 font-normal">
            <Checkbox checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
            Active (can receive reports)
          </Label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {editing ? "Save changes" : "Add recipient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

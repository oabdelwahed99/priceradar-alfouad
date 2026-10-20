"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { buildSeoDraftPrompt } from "@/lib/services/content/seo-draft";
import type { ProductContentAnalysisDTO, SeoContentDraftDTO, SeoContentDraftResultDTO } from "@/types/dto";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{label}</p>
        <Button type="button" variant="ghost" size="xs" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check className="text-emerald-600" /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function DraftFields({ draft }: { draft: SeoContentDraftDTO }) {
  return (
    <div className="space-y-3">
      <CopyField label="Page title" value={draft.title} />
      <CopyField label="Meta description" value={draft.metaDescription} />
      <CopyField label="H1" value={draft.h1} />
      <CopyField label="Description" value={draft.description} />
      {draft.headings.length > 0 ? (
        <CopyField label="H2 headings" value={draft.headings.map((h) => `• ${h}`).join("\n")} />
      ) : null}
      {draft.bulletPoints.length > 0 ? (
        <CopyField label="Bullet points" value={draft.bulletPoints.map((b) => `• ${b}`).join("\n")} />
      ) : null}
      {draft.faq.length > 0 ? (
        <CopyField
          label="FAQ"
          value={draft.faq.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join("\n\n")}
        />
      ) : null}
      {draft.unverifiedFacts.length > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">Do not assert without verifying</p>
          <p className="mt-1 text-muted-foreground dark:text-amber-200/80">
            Competitors mention these, but they were not confirmed on your page: {draft.unverifiedFacts.join(", ")}.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function SeoDraftDialog({
  productId,
  product,
  analysis,
  disabledReason,
}: {
  productId: string;
  product: { name: string; brand: string | null; size: string | null };
  analysis: ProductContentAnalysisDTO;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [promptShown, setPromptShown] = useState("");
  const [draft, setDraft] = useState<SeoContentDraftDTO | null>(null);

  const previewPrompt = useMemo(() => buildSeoDraftPrompt(product, analysis), [product, analysis]);

  function onOpenChange(next: boolean) {
    if (next) {
      setPromptShown(previewPrompt);
      setDraft(null);
    }
    setOpen(next);
  }

  async function generate() {
    setBusy(true);
    try {
      const result = await apiFetch<SeoContentDraftResultDTO>(`/api/products/${productId}/content/draft`, {
        method: "POST",
      });
      setPromptShown(result.prompt);
      setDraft(result.draft);
      toast.success("SEO draft generated.");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not generate SEO draft.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = Boolean(disabledReason);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            title={disabledReason}
            aria-label={disabledReason ?? "Generate SEO draft with AI"}
          />
        }
      >
        <Sparkles />
        AI draft
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>AI SEO draft</DialogTitle>
          <DialogDescription>
            Original copy informed by competitor gaps. Review before publishing — do not paste competitor text.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Prompt {draft ? "sent to AI" : "to send"}
            </p>
            <pre className="max-h-56 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap">
              {promptShown || previewPrompt}
            </pre>
          </div>

          {draft ? (
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Generated draft</p>
              <DraftFields draft={draft} />
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 sm:justify-between">
          <p className="text-xs text-muted-foreground sm:max-w-[55%]">
            Nothing is saved to the product. Copy the fields you want into your store.
          </p>
          <Button onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy ? "Generating…" : draft ? "Regenerate" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

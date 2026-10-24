"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
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
import type { CampaignIdeaDTO, CampaignIdeasResultDTO } from "@/types/dto";

function IdeaCard({ idea }: { idea: CampaignIdeaDTO }) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="font-medium">{idea.name}</p>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Audience:</span> {idea.targetAudience}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Message (EN)</p>
          <p className="mt-1 text-sm leading-relaxed">{idea.keyMessageEn}</p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Message (AR)</p>
          <p dir="rtl" className="mt-1 text-sm leading-relaxed">
            {idea.keyMessageAr}
          </p>
        </div>
      </div>
      {idea.channels.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {idea.channels.map((channel) => (
            <span key={channel} className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {channel}
            </span>
          ))}
        </div>
      ) : null}
      {idea.supportingEvidence.length > 0 ? (
        <ul className="list-inside list-disc text-xs text-muted-foreground">
          {idea.supportingEvidence.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function CampaignIdeasDialog({
  brand,
  retailerId,
  disabled,
}: {
  brand: string | null;
  retailerId: string | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<CampaignIdeaDTO[] | null>(null);

  async function generate() {
    setLoading(true);
    try {
      const result = await apiFetch<CampaignIdeasResultDTO>("/api/campaigns/ideas", {
        method: "POST",
        body: JSON.stringify({
          brand: brand ?? "all",
          retailerId: retailerId || undefined,
        }),
      });
      setIdeas(result.ideas);
    } catch (error) {
      const message =
        error instanceof ApiClientError ? error.message : "Could not generate campaign ideas.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setIdeas(null);
      }}
    >
      <DialogTrigger render={<Button type="button" disabled={disabled} />}>
        <Sparkles /> Generate campaign ideas
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI campaign ideas</DialogTitle>
          <DialogDescription>
            Uses the current review insights{brand ? ` for ${brand}` : ""} to draft bilingual campaign concepts.
            Requires OPENAI_API_KEY.
          </DialogDescription>
        </DialogHeader>

        {ideas ? (
          <div className="space-y-3">
            {ideas.map((idea) => (
              <IdeaCard key={idea.name} idea={idea} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            We will send the ranked insights and a few short review snippets to OpenAI. Full competitor review text is not
            included.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button type="button" onClick={generate} disabled={loading || disabled}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {loading ? "Generating…" : ideas ? "Regenerate" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

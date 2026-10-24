import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import type { CampaignIdeaDTO, CampaignInsightDTO, CampaignIdeasResultDTO, CampaignProductAngleDTO } from "@/types/dto";

export function buildCampaignIdeasPrompt(
  insights: CampaignInsightDTO[],
  brand: string | null,
  productAngles: CampaignProductAngleDTO[] = [],
): string {
  const top = insights.slice(0, 8);
  const insightBlock =
    top.length === 0
      ? "- (no rule-based insights available yet)"
      : top
          .map((i, idx) => {
            const snippets =
              i.sampleSnippets.length > 0
                ? `\n  Sample snippets: ${i.sampleSnippets.map((s) => `"${s}"`).join(" · ")}`
                : "";
            return `${idx + 1}. [${i.type}] ${i.title}\n  Evidence: ${i.evidence}\n  Suggested action: ${i.suggestedAction}${snippets}`;
          })
          .join("\n");

  const angleBlock =
    productAngles.length === 0
      ? ""
      : `\n## Customer quotes by product\nThese are real reviews, including the official store. Quote them only when the words support the idea.\n${productAngles
          .slice(0, 8)
          .map((angle) => {
            const praise = angle.praise.map((q) => `"${q.text}" (${q.retailerName})`).join(" · ") || "none";
            const complaints = angle.complaints.map((q) => `"${q.text}" (${q.retailerName})`).join(" · ") || "none";
            return `- ${angle.productName}: ${angle.positive} positive, ${angle.negative} negative. Praise: ${praise}. Complaints: ${complaints}.`;
          })
          .join("\n")}\n`;

  return `You are a beauty / cosmetics marketing strategist for an online retailer in the Gulf region.
Turn the review-based insights below into concrete campaign ideas.

Brand focus: ${brand ?? "all brands"}

## Insights from customer reviews across stores
${insightBlock}
${angleBlock}

## Output rules
- Return JSON only matching the required schema
- Propose 3 to 5 distinct campaign ideas
- Each idea needs: name, targetAudience, keyMessageAr (Arabic), keyMessageEn (English), channels (array), supportingEvidence (short bullets grounded in the insights)
- Do not invent product claims, ingredients, certifications, or medical benefits that are not supported by the insights
- Prefer channels common in the region: Meta ads, Snapchat, TikTok, Google Shopping, WhatsApp, email, SMS, PDP testimonials, influencer seeding
- Keep Arabic and English messages natural and shopper-friendly, not literal translations of each other when a local phrasing works better
`;
}

const campaignIdeaSchema = z.object({
  name: z.string().min(1),
  targetAudience: z.string().min(1),
  keyMessageAr: z.string().min(1),
  keyMessageEn: z.string().min(1),
  channels: z.array(z.string()),
  supportingEvidence: z.array(z.string()),
});

const campaignIdeasResponseSchema = z.object({
  ideas: z.array(campaignIdeaSchema).min(1).max(8),
});

export const CAMPAIGN_IDEAS_JSON_SCHEMA = {
  name: "campaign_ideas",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["ideas"],
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "targetAudience",
            "keyMessageAr",
            "keyMessageEn",
            "channels",
            "supportingEvidence",
          ],
          properties: {
            name: { type: "string" },
            targetAudience: { type: "string" },
            keyMessageAr: { type: "string" },
            keyMessageEn: { type: "string" },
            channels: { type: "array", items: { type: "string" } },
            supportingEvidence: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
} as const;

export function parseCampaignIdeasResponse(raw: string): CampaignIdeaDTO[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("The AI returned invalid JSON. Please try again.");
  }
  const result = campaignIdeasResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError("The AI response was missing required campaign fields. Please try again.", result.error.flatten());
  }
  return result.data.ideas;
}

export type { CampaignIdeasResultDTO };

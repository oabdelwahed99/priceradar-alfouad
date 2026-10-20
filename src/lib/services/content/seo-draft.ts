import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import type { ContentPageDTO, ProductContentAnalysisDTO, SeoContentDraftDTO } from "@/types/dto";
import {
  META_DESCRIPTION_LENGTH,
  MIN_DESCRIPTION_WORDS,
  TITLE_LENGTH,
  missingFacts,
} from "./content-analysis";

export interface SeoDraftProductContext {
  name: string;
  brand: string | null;
  size: string | null;
}

function bullet(lines: string[]): string {
  return lines.map((l) => `- ${l}`).join("\n");
}

function ownPage(analysis: ProductContentAnalysisDTO): ContentPageDTO | null {
  return analysis.pages.find((p) => p.isOwnStore && p.captured) ?? null;
}

function competitorNotes(analysis: ProductContentAnalysisDTO): string {
  const lines: string[] = [];
  for (const page of analysis.pages.filter((p) => !p.isOwnStore && p.captured)) {
    const parts: string[] = [];
    if (page.headings.h1.length) parts.push(`H1: ${page.headings.h1.join(" | ")}`);
    if (page.headings.h2.length) parts.push(`H2: ${page.headings.h2.join(" | ")}`);
    if (page.faqQuestions.length) parts.push(`FAQ: ${page.faqQuestions.join(" | ")}`);
    if (parts.length === 0) continue;
    lines.push(`${page.retailerName}: ${parts.join("; ")}`);
  }
  return lines.length > 0 ? bullet(lines) : "- (none captured)";
}

/**
 * Builds the user prompt sent to OpenAI for an SEO content draft.
 * Competitor description bodies are intentionally omitted to avoid encouraging copy-paste.
 */
export function buildSeoDraftPrompt(product: SeoDraftProductContext, analysis: ProductContentAnalysisDTO): string {
  const own = ownPage(analysis);
  const language = own?.language === "ar" ? "Arabic" : own?.language === "en" ? "English" : own?.language || "the same language as the current page copy (Arabic or English)";
  const medianWords = analysis.benchmark.competitorMedian.descriptionWords;
  const descriptionTarget = Math.max(MIN_DESCRIPTION_WORDS, medianWords != null ? Math.round(medianWords) : MIN_DESCRIPTION_WORDS);

  const failingChecks = analysis.checks
    .filter((c) => c.status === "fail" || c.status === "warn")
    .map((c) => `${c.label} (${c.status}): ${c.message}`);

  const missingKeywords = analysis.keywords.missing.map((t) => t.term);
  const unverifiedFacts = missingFacts(analysis.attributes, analysis.competitorPagesCaptured).map((a) => a.label);

  const productLine = [product.name, product.brand ? `Brand: ${product.brand}` : null, product.size ? `Size: ${product.size}` : null]
    .filter(Boolean)
    .join(" · ");

  const ownSection = own
    ? [
        `Title: ${own.title ?? "(missing)"}`,
        `Meta description: ${own.metaDescription ?? "(missing)"}`,
        `H1: ${own.headings.h1.join(" | ") || "(missing)"}`,
        `H2: ${own.headings.h2.join(" | ") || "(none)"}`,
        `Bullet points: ${own.bulletPoints.length ? own.bulletPoints.join(" | ") : "(none)"}`,
        `FAQ questions: ${own.faqQuestions.length ? own.faqQuestions.join(" | ") : "(none)"}`,
        `Description:\n${own.description?.trim() || "(missing)"}`,
      ].join("\n")
    : "(Your product page content has not been captured yet.)";

  const medians = analysis.benchmark.competitorMedian;
  const bulletTarget = medians.bulletCount != null && medians.bulletCount > 0 ? Math.round(medians.bulletCount) : 4;
  const faqTarget = medians.faqCount != null && medians.faqCount > 0 ? Math.max(2, Math.round(medians.faqCount)) : 3;
  const h2Target = medians.h2Count != null && medians.h2Count > 0 ? Math.round(medians.h2Count) : 2;

  return `You are an SEO copywriter for a cosmetics / beauty product page. Write original product copy for our store, informed by competitor gaps. Do not copy competitor wording.

Product: ${productLine}
Write the draft in ${language}.

## Length targets
- Page title: ${TITLE_LENGTH.min}–${TITLE_LENGTH.max} characters
- Meta description: ${META_DESCRIPTION_LENGTH.min}–${META_DESCRIPTION_LENGTH.max} characters
- Product description: at least ${descriptionTarget} words
- Aim for roughly ${bulletTarget} bullet points and ${faqTarget} FAQ items when those are weak or missing
- Aim for about ${h2Target} H2 headings when headings are weak or missing

## Issues to fix on our page
${failingChecks.length > 0 ? bullet(failingChecks) : "- (no failing or warning checks)"}

## Missing keywords to weave in naturally
${missingKeywords.length > 0 ? bullet(missingKeywords) : "- (none)"}

## Product facts competitors mention that our page does not
Treat these as research notes only. Do NOT assert them as facts about our product unless they already appear in our current copy. List any you could not verify from our page in "unverifiedFacts".
${unverifiedFacts.length > 0 ? bullet(unverifiedFacts) : "- (none)"}

## Our current page copy
${ownSection}

## Competitor page structure (headings and FAQ questions only — not their descriptions)
${competitorNotes(analysis)}

## Output rules
- Return JSON only matching the required schema
- title, metaDescription, h1, description, headings (H2 strings), bulletPoints, faq (question + answer), unverifiedFacts
- Keep claims grounded in our current page; invent nothing about ingredients, certifications, ratings, or medical benefits that we do not already state
- Prefer clear, shopper-friendly copy over keyword stuffing
`;
}

const seoDraftSchema = z.object({
  title: z.string().min(1),
  metaDescription: z.string().min(1),
  h1: z.string().min(1),
  description: z.string().min(1),
  headings: z.array(z.string()),
  bulletPoints: z.array(z.string()),
  faq: z.array(
    z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
    }),
  ),
  unverifiedFacts: z.array(z.string()),
});

/** JSON Schema for OpenAI response_format (strict). */
export const SEO_DRAFT_JSON_SCHEMA = {
  name: "seo_content_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "metaDescription", "h1", "description", "headings", "bulletPoints", "faq", "unverifiedFacts"],
    properties: {
      title: { type: "string" },
      metaDescription: { type: "string" },
      h1: { type: "string" },
      description: { type: "string" },
      headings: { type: "array", items: { type: "string" } },
      bulletPoints: { type: "array", items: { type: "string" } },
      faq: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "answer"],
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
          },
        },
      },
      unverifiedFacts: { type: "array", items: { type: "string" } },
    },
  },
} as const;

export function parseSeoDraftResponse(raw: string): SeoContentDraftDTO {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("The AI returned invalid JSON. Please try again.");
  }
  const result = seoDraftSchema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError("The AI response was missing required draft fields. Please try again.", result.error.flatten());
  }
  return result.data;
}

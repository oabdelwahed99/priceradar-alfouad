import type {
  ContentAttributeDTO,
  ContentCheckDTO,
  ContentMetricsDTO,
  ContentPageDTO,
  ProductContentAnalysisDTO,
} from "@/types/dto";
import { toIso } from "../mappers";
import {
  buildKeywordGap,
  CONTENT_ATTRIBUTES,
  countWords,
  detectAttributes,
  median,
  termCounts,
  textSimilarity,
  tokenize,
} from "./text-analysis";

export const TITLE_LENGTH = { min: 30, max: 65 } as const;
export const META_DESCRIPTION_LENGTH = { min: 70, max: 160 } as const;
export const MIN_DESCRIPTION_WORDS = 50;
export const SIMILARITY_THRESHOLDS = { duplicate: 80, similar: 60 } as const;
export const MIN_IMAGE_ALT_COVERAGE = 80;

export interface ContentFields {
  title: string | null;
  metaDescription: string | null;
  description: string | null;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  bulletPoints: string[];
  faqQuestions: string[];
  rating: { value: number | null; count: number | null } | null;
  images: { total: number; withAlt: number };
  language: string | null;
}

export interface ContentPageInput {
  sourceId: string;
  retailerName: string;
  url: string;
  isOwnStore: boolean;
  content: ContentFields | null;
  contentSince: Date | string | null;
  lastSeenAt: Date | string | null;
  versionCount: number;
}

export function contentMetrics(c: ContentFields): ContentMetricsDTO {
  return {
    descriptionWords: countWords(c.description),
    titleLength: c.title?.length ?? 0,
    metaDescriptionLength: c.metaDescription?.length ?? 0,
    h1Count: c.headings.h1.length,
    h2Count: c.headings.h2.length,
    bulletCount: c.bulletPoints.length,
    faqCount: c.faqQuestions.length,
    imageAltCoverage: c.images.total > 0 ? Math.round((c.images.withAlt / c.images.total) * 100) : null,
    hasRating: Boolean(c.rating && (c.rating.value !== null || c.rating.count !== null)),
  };
}

/** All the copy a shopper or search engine reads on the page. */
export function contentText(c: ContentFields): string {
  return [c.title, c.metaDescription, c.description, ...c.headings.h1, ...c.headings.h2, ...c.headings.h3, ...c.bulletPoints, ...c.faqQuestions]
    .filter(Boolean)
    .join("\n");
}

/** Store names in page titles ("Argan Oil | StoreName") would otherwise surface as keywords. */
function storeNameTokens(pages: ContentPageInput[]): Set<string> {
  const tokens = new Set<string>();
  for (const p of pages) {
    const host = (() => {
      try {
        return new URL(p.url).hostname.replace(/^www\./, "").split(".")[0];
      } catch {
        return "";
      }
    })();
    for (const t of tokenize(`${p.retailerName} ${host}`)) tokens.add(t);
  }
  return tokens;
}

function termsWithout(text: string, excluded: Set<string>): Map<string, number> {
  const counts = termCounts(text);
  for (const term of [...counts.keys()]) {
    if (term.split(" ").some((t) => excluded.has(t))) counts.delete(term);
  }
  return counts;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

interface CheckContext {
  own: ContentFields;
  ownMetrics: ContentMetricsDTO;
  competitorMetrics: ContentMetricsDTO[];
  medianWords: number | null;
  mostSimilar: { retailerName: string; similarity: number } | null;
  missingKeywords: number;
  missingAttributes: string[];
}

function buildChecks(ctx: CheckContext): ContentCheckDTO[] {
  const { own, ownMetrics: m, competitorMetrics: cm } = ctx;
  const checks: ContentCheckDTO[] = [];
  const share = (pred: (x: ContentMetricsDTO) => boolean) => cm.filter(pred).length;

  if (!own.title) {
    checks.push({ id: "title", label: "Page title", status: "fail", message: "Your page has no <title>. It is the headline Google shows in search results." });
  } else if (m.titleLength < TITLE_LENGTH.min) {
    checks.push({ id: "title", label: "Page title", status: "warn", message: `Title is ${m.titleLength} characters. Aim for ${TITLE_LENGTH.min}–${TITLE_LENGTH.max} and include the product type and a key benefit.` });
  } else if (m.titleLength > TITLE_LENGTH.max) {
    checks.push({ id: "title", label: "Page title", status: "warn", message: `Title is ${m.titleLength} characters; Google usually cuts it off after about 60.` });
  } else {
    checks.push({ id: "title", label: "Page title", status: "pass", message: `Title length is good (${m.titleLength} characters).` });
  }

  if (!own.metaDescription) {
    checks.push({ id: "meta_description", label: "Meta description", status: "fail", message: "No meta description. Google will pick a random snippet from the page instead." });
  } else if (m.metaDescriptionLength < META_DESCRIPTION_LENGTH.min) {
    checks.push({ id: "meta_description", label: "Meta description", status: "warn", message: `Meta description is ${m.metaDescriptionLength} characters. Aim for ${META_DESCRIPTION_LENGTH.min}–${META_DESCRIPTION_LENGTH.max}.` });
  } else if (m.metaDescriptionLength > META_DESCRIPTION_LENGTH.max) {
    checks.push({ id: "meta_description", label: "Meta description", status: "warn", message: `Meta description is ${m.metaDescriptionLength} characters and will be truncated after about ${META_DESCRIPTION_LENGTH.max}.` });
  } else {
    checks.push({ id: "meta_description", label: "Meta description", status: "pass", message: `Meta description length is good (${m.metaDescriptionLength} characters).` });
  }

  if (m.h1Count === 0) {
    checks.push({ id: "h1", label: "Main heading (H1)", status: "fail", message: "No H1 heading found. Use the product name as the page's single H1." });
  } else if (m.h1Count > 1) {
    checks.push({ id: "h1", label: "Main heading (H1)", status: "warn", message: `${m.h1Count} H1 headings found. Keep one H1 with the product name.` });
  } else {
    checks.push({ id: "h1", label: "Main heading (H1)", status: "pass", message: "One H1 heading." });
  }

  if (m.descriptionWords === 0) {
    checks.push({ id: "description", label: "Description depth", status: "fail", message: "No product description found on your page." });
  } else if (ctx.medianWords !== null && m.descriptionWords < ctx.medianWords * 0.5) {
    checks.push({ id: "description", label: "Description depth", status: "warn", message: `Your description has ${plural(m.descriptionWords, "word")}; competitors' median is ${Math.round(ctx.medianWords)}.` });
  } else if (m.descriptionWords < MIN_DESCRIPTION_WORDS) {
    checks.push({ id: "description", label: "Description depth", status: "warn", message: `Your description has only ${plural(m.descriptionWords, "word")}. Thin pages rarely rank; aim for at least ${MIN_DESCRIPTION_WORDS}.` });
  } else {
    const vs = ctx.medianWords !== null ? ` (competitor median ${Math.round(ctx.medianWords)})` : "";
    checks.push({ id: "description", label: "Description depth", status: "pass", message: `Your description has ${plural(m.descriptionWords, "word")}${vs}.` });
  }

  if (ctx.mostSimilar === null) {
    checks.push({ id: "duplicate", label: "Original copy", status: "info", message: "Not enough text to compare your description with competitors'." });
  } else if (ctx.mostSimilar.similarity >= SIMILARITY_THRESHOLDS.duplicate) {
    checks.push({ id: "duplicate", label: "Original copy", status: "fail", message: `Your description overlaps ${ctx.mostSimilar.similarity}% with ${ctx.mostSimilar.retailerName}'s, probably the same manufacturer text. Rewrite it so Google has a reason to rank your page.` });
  } else if (ctx.mostSimilar.similarity >= SIMILARITY_THRESHOLDS.similar) {
    checks.push({ id: "duplicate", label: "Original copy", status: "warn", message: `Your description overlaps ${ctx.mostSimilar.similarity}% with ${ctx.mostSimilar.retailerName}'s.` });
  } else {
    checks.push({ id: "duplicate", label: "Original copy", status: "pass", message: `Your description is distinct (highest overlap ${ctx.mostSimilar.similarity}%, ${ctx.mostSimilar.retailerName}).` });
  }

  if (cm.length > 0) {
    checks.push(
      ctx.missingKeywords > 5
        ? { id: "keywords", label: "Market keywords", status: "warn", message: `${ctx.missingKeywords} terms used widely by competitors are missing from your page. See the keyword gap below.` }
        : { id: "keywords", label: "Market keywords", status: "pass", message: ctx.missingKeywords === 0 ? "Your page covers the terms competitors commonly use." : `Only ${plural(ctx.missingKeywords, "common term")} missing.` },
    );
  }

  if (ctx.missingAttributes.length > 0) {
    checks.push({ id: "attributes", label: "Product facts", status: "warn", message: `Most competitors mention ${ctx.missingAttributes.join(", ")}; your page doesn't.` });
  } else if (cm.length > 0) {
    checks.push({ id: "attributes", label: "Product facts", status: "pass", message: "You cover the product facts most competitors mention." });
  }

  const bulletPeers = share((x) => x.bulletCount > 0);
  if (m.bulletCount > 0) {
    checks.push({ id: "bullets", label: "Scannable bullet points", status: "pass", message: `${plural(m.bulletCount, "bullet point")} in your description.` });
  } else if (bulletPeers > 0 && bulletPeers >= cm.length / 2) {
    checks.push({ id: "bullets", label: "Scannable bullet points", status: "warn", message: `${bulletPeers} of ${cm.length} competitors use bullet points for benefits; your description has none.` });
  }

  const faqPeers = share((x) => x.faqCount > 0);
  if (m.faqCount > 0) {
    checks.push({ id: "faq", label: "FAQ markup", status: "pass", message: `${plural(m.faqCount, "FAQ question")} marked up for search results.` });
  } else if (faqPeers > 0) {
    checks.push({ id: "faq", label: "FAQ markup", status: "warn", message: `${faqPeers} of ${cm.length} competitors publish FAQ markup, which can earn extra space in Google results.` });
  } else {
    checks.push({ id: "faq", label: "FAQ markup", status: "info", message: "No competitor uses FAQ markup either; adding one is an easy way to stand out." });
  }

  const ratingPeers = share((x) => x.hasRating);
  if (m.hasRating) {
    checks.push({ id: "rating", label: "Review stars markup", status: "pass", message: "Your page exposes a rating that Google can show as stars." });
  } else if (ratingPeers > 0) {
    checks.push({ id: "rating", label: "Review stars markup", status: "warn", message: `${ratingPeers} of ${cm.length} competitors show review stars in their markup; you don't.` });
  }

  if (m.imageAltCoverage !== null) {
    checks.push(
      m.imageAltCoverage < MIN_IMAGE_ALT_COVERAGE
        ? { id: "image_alt", label: "Image alt text", status: "warn", message: `Only ${m.imageAltCoverage}% of your images have alt text. Describe them for image search and accessibility.` }
        : { id: "image_alt", label: "Image alt text", status: "pass", message: `${m.imageAltCoverage}% of images have alt text.` },
    );
  }

  return checks;
}

/** Facts at least half of the captured competitor pages mention and your page doesn't. */
export function missingFacts(attributes: ContentAttributeDTO[], competitorPagesCaptured: number): ContentAttributeDTO[] {
  if (competitorPagesCaptured === 0) return [];
  return attributes.filter(
    (a) => a.own === false && a.competitorsWith.length >= Math.max(1, competitorPagesCaptured / 2),
  );
}

/** Pure: turns the latest captured content of each source into the Content & SEO analysis. */
export function buildContentAnalysis(pages: ContentPageInput[]): ProductContentAnalysisDTO {
  const excluded = storeNameTokens(pages);
  const ownPage = pages.find((p) => p.isOwnStore && p.content) ?? null;
  const own = ownPage?.content ?? null;
  const competitors = pages.filter((p) => !p.isOwnStore);
  const captured = competitors.filter((p): p is ContentPageInput & { content: ContentFields } => p.content !== null);

  const keywords = buildKeywordGap(
    own ? termsWithout(contentText(own), excluded) : null,
    captured.map((p) => termsWithout(contentText(p.content), excluded)),
  );

  const attributeSets = new Map(captured.map((p) => [p.sourceId, detectAttributes(contentText(p.content))]));
  const ownAttributes = own ? detectAttributes(contentText(own)) : null;
  const attributes: ContentAttributeDTO[] = CONTENT_ATTRIBUTES.map((a) => ({
    id: a.id,
    label: a.label,
    own: ownAttributes ? ownAttributes.has(a.id) : null,
    competitorsWith: captured.filter((p) => attributeSets.get(p.sourceId)!.has(a.id)).map((p) => p.retailerName),
  }));

  const similarity = new Map(captured.map((p) => [p.sourceId, own ? textSimilarity(own.description, p.content.description) : null]));
  const mostSimilar = captured.reduce<{ retailerName: string; similarity: number } | null>((best, p) => {
    const s = similarity.get(p.sourceId);
    return s != null && (!best || s > best.similarity) ? { retailerName: p.retailerName, similarity: s } : best;
  }, null);

  const competitorMetrics = captured.map((p) => contentMetrics(p.content));
  const medianOf = (pick: (m: ContentMetricsDTO) => number) => median(competitorMetrics.map(pick));
  const medianWords = median(competitorMetrics.map((m) => m.descriptionWords).filter((w) => w > 0));
  const ownMetrics = own ? contentMetrics(own) : null;

  const checks =
    own && ownMetrics
      ? buildChecks({
          own,
          ownMetrics,
          competitorMetrics,
          medianWords,
          mostSimilar,
          missingKeywords: keywords.missing.length,
          missingAttributes: missingFacts(attributes, captured.length).map((a) => a.label.toLowerCase()),
        })
      : [];
  const scored = checks.filter((c) => c.status !== "info");
  const score = own && scored.length > 0 ? Math.round((scored.filter((c) => c.status === "pass").length / scored.length) * 100) : null;

  const pageDTOs: ContentPageDTO[] = pages.map((p) => {
    const c = p.content;
    return {
      sourceId: p.sourceId,
      retailerName: p.retailerName,
      url: p.url,
      isOwnStore: p.isOwnStore,
      captured: c !== null,
      title: c?.title ?? null,
      metaDescription: c?.metaDescription ?? null,
      description: c?.description ?? null,
      headings: c?.headings ?? { h1: [], h2: [], h3: [] },
      bulletPoints: c?.bulletPoints ?? [],
      faqQuestions: c?.faqQuestions ?? [],
      rating: c?.rating ?? null,
      language: c?.language ?? null,
      metrics: c ? contentMetrics(c) : null,
      similarityToOwn: similarity.get(p.sourceId) ?? null,
      contentSince: toIso(p.contentSince),
      lastSeenAt: toIso(p.lastSeenAt),
      versionCount: p.versionCount,
    };
  });

  return {
    status: own || captured.length > 0 ? "OK" : "NO_CONTENT",
    ownPageCaptured: Boolean(own),
    competitorCount: competitors.length,
    competitorPagesCaptured: captured.length,
    score,
    checks,
    benchmark: {
      own: ownMetrics,
      competitorMedian: {
        descriptionWords: medianWords,
        h2Count: medianOf((m) => m.h2Count),
        bulletCount: medianOf((m) => m.bulletCount),
        faqCount: medianOf((m) => m.faqCount),
      },
    },
    keywords,
    attributes,
    pages: pageDTOs,
  };
}

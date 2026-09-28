/**
 * Deterministic text utilities for content analysis. Handles English and Arabic:
 * Arabic text is normalized (diacritics, letter variants, definite article) so that
 * spelling variants of the same word are counted together.
 */

const ENGLISH_STOPWORDS = `a about above after again against all also am an and any are as at be because been before being
below between both but by can could did do does doing down during each few for from further had has have having he her
here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on
once only or other our ours ourselves out over own same she should so some such than that the their theirs them
themselves then there these they this those through to too under until up very was we were what when where which while
who whom why will with would you your yours yourself yourselves use using used get gets make makes made one two new
may might must shall per via etc`.split(/\s+/);

/** Store chrome and commerce boilerplate that says nothing about the product. ("free" stays: "sulfate free".) */
const COMMERCE_STOPWORDS = `add cart buy shop shopping order orders price prices sale offer offers shipping delivery
return returns stock available availability item items product products quantity qty wishlist review reviews reviewed
rating ratings share customer customers sku category categories brand brands home page click read more less details
description sar aed egp kwd qar usd`.split(/\s+/);

const ARABIC_STOPWORDS = `في من على الى إلى عن مع هذا هذه ذلك تلك التي الذي الذين او أو و ثم كل بعض قد لا لم لن ما ماذا كيف
هو هي هم نحن انت أنت انا أنا كان كانت يكون تكون عند حتى اذا إذا لكن بين كما ايضا أيضا غير بعد قبل حيث فيه فيها به بها له لها
يا ان أن إن اي أي هل منتج منتجات المنتج المنتجات السعر سعر اضف أضف السلة سلة شراء اشتري الشحن شحن مجاني التوصيل توصيل
متوفر متوفرة المخزون الكمية تقييم تقييمات مراجعات ريال درهم جنيه دينار`.split(/\s+/);

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const ARABIC_LETTER = /[\u0600-\u06FF]/;

export function normalizeArabic(text: string): string {
  return text
    .replace(ARABIC_DIACRITICS, "")
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

/** Strips the Arabic definite article and its common attached prepositions (وال، بال، لل...). */
function stripArabicArticle(token: string): string {
  if (!ARABIC_LETTER.test(token)) return token;
  for (const prefix of ["وال", "بال", "فال", "كال"]) {
    if (token.startsWith(prefix) && token.length >= 6) return token.slice(3);
  }
  if (token.startsWith("لل") && token.length >= 5) return token.slice(2);
  if (token.startsWith("ال") && token.length >= 5) return token.slice(2);
  return token;
}

const STOPWORDS = new Set(
  [...ENGLISH_STOPWORDS, ...COMMERCE_STOPWORDS, ...ARABIC_STOPWORDS.map((w) => stripArabicArticle(normalizeArabic(w)))].filter(Boolean),
);

function normalizeToken(raw: string): string {
  return stripArabicArticle(normalizeArabic(raw.toLowerCase()));
}

function isMeaningful(token: string): boolean {
  if (STOPWORDS.has(token)) return false;
  if (/^\d+$/.test(token)) return false;
  if (/^[a-z]+$/.test(token)) return token.length >= 3;
  return token.length >= 2;
}

/** Every word-like token, normalized, stopwords included (null marks a stopword so bigrams don't span it). */
function tokenSequence(text: string): (string | null)[] {
  return normalizeArabic(text)
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
    .map((raw) => {
      const token = normalizeToken(raw);
      return isMeaningful(token) ? token : null;
    });
}

export function tokenize(text: string): string[] {
  return tokenSequence(text).filter((t): t is string => t !== null);
}

export function countWords(text: string | null | undefined): number {
  return text ? (text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).length : 0;
}

/** Term frequencies for unigrams and adjacent-word bigrams (phrases such as "sulfate free"). */
export function termCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (term: string) => counts.set(term, (counts.get(term) ?? 0) + 1);
  const seq = tokenSequence(text);
  seq.forEach((token, i) => {
    if (token === null) return;
    add(token);
    const next = seq[i + 1];
    if (next) add(`${token} ${next}`);
  });
  return counts;
}

export interface KeywordTerm {
  term: string;
  isPhrase: boolean;
  /** Competitor pages that use the term. */
  competitorCount: number;
  competitorOccurrences: number;
  ownOccurrences: number;
}

export interface KeywordGap {
  /** Minimum number of competitor pages a term must appear on to count as a market term. */
  minCompetitors: number;
  competitorPagesAnalyzed: number;
  /** Market terms missing from your page, most widely used first. */
  missing: KeywordTerm[];
  /** Market terms your page already uses. */
  shared: KeywordTerm[];
  /** Terms you use repeatedly that no competitor uses. */
  uniqueToYou: { term: string; ownOccurrences: number }[];
}

export function minCompetitorsForTerm(competitorPages: number): number {
  return competitorPages >= 3 ? Math.max(2, Math.ceil(competitorPages * 0.3)) : 1;
}

const byUsage = (a: KeywordTerm, b: KeywordTerm) =>
  b.competitorCount - a.competitorCount ||
  b.competitorOccurrences - a.competitorOccurrences ||
  Number(b.isPhrase) - Number(a.isPhrase) ||
  a.term.localeCompare(b.term);

export function buildKeywordGap(
  own: Map<string, number> | null,
  competitors: Map<string, number>[],
  limits = { missing: 25, shared: 20, unique: 15 },
): KeywordGap {
  const minCompetitors = minCompetitorsForTerm(competitors.length);
  const usage = new Map<string, { pages: number; occurrences: number }>();
  for (const counts of competitors) {
    for (const [term, n] of counts) {
      const u = usage.get(term) ?? { pages: 0, occurrences: 0 };
      u.pages += 1;
      u.occurrences += n;
      usage.set(term, u);
    }
  }

  const market: KeywordTerm[] = [];
  for (const [term, u] of usage) {
    if (u.pages < minCompetitors) continue;
    market.push({
      term,
      isPhrase: term.includes(" "),
      competitorCount: u.pages,
      competitorOccurrences: u.occurrences,
      ownOccurrences: own?.get(term) ?? 0,
    });
  }
  market.sort(byUsage);

  const uniqueToYou = own
    ? [...own]
        .filter(([term, n]) => n >= 2 && !usage.has(term))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limits.unique)
        .map(([term, ownOccurrences]) => ({ term, ownOccurrences }))
    : [];

  return {
    minCompetitors,
    competitorPagesAnalyzed: competitors.length,
    missing: market.filter((t) => t.ownOccurrences === 0).slice(0, limits.missing),
    shared: market.filter((t) => t.ownOccurrences > 0).slice(0, limits.shared),
    uniqueToYou,
  };
}

const MIN_TOKENS_FOR_SIMILARITY = 20;

/**
 * Share of the shorter text's vocabulary that also appears in the other, in % (0–100). Containment rather than
 * Jaccard, so manufacturer copy with a sentence added still scores as a near-duplicate. Null when either text is
 * too short to judge.
 */
export function textSimilarity(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length < MIN_TOKENS_FOR_SIMILARITY || tb.length < MIN_TOKENS_FOR_SIMILARITY) return null;
  const sa = new Set(ta);
  const sb = new Set(tb);
  let shared = 0;
  for (const t of sa) if (sb.has(t)) shared += 1;
  return Math.round((shared / Math.min(sa.size, sb.size)) * 100);
}

export interface ContentAttribute {
  id: string;
  label: string;
  pattern: RegExp;
}

/** Product facts shoppers and search engines look for on cosmetics pages, in English and Arabic. */
export const CONTENT_ATTRIBUTES: ContentAttribute[] = [
  { id: "ingredients", label: "Ingredients list", pattern: /ingredients|\binci\b|المكونات|مكونات/i },
  { id: "how_to_use", label: "How to use", pattern: /how to use|directions|instructions for use|طريقة (الاستخدام|الإستخدام|الاستعمال)|كيفية الاستخدام|طريقة الاستعمال/i },
  { id: "benefits", label: "Benefits", pattern: /benefits|فوائد|المميزات|مميزات/i },
  { id: "size", label: "Size / volume", pattern: /\d+(?:[.,]\d+)?\s?(?:ml|g|gm|gr|oz|fl\.?\s?oz|مل|ملل|جم|جرام|غرام)(?![a-z])/i },
  { id: "hair_type", label: "Hair type", pattern: /(?:curly|wavy|straight|dry|oily|damaged|colou?r(?:ed|-treated)|fine|thick|frizzy|thin)\s+hair|all hair types|hair type|شعر\s+(?:مجعد|جاف|دهني|تالف|مصبوغ|خشن|ناعم|متقصف|كيرلي)|(?:جميع|لكل)\s+أنواع\s+الشعر|نوع الشعر/i },
  { id: "skin_type", label: "Skin type", pattern: /(?:dry|oily|combination|sensitive|normal|acne[\s-]prone|mature)\s+skin|all skin types|skin type|بشرة\s+(?:جافة|دهنية|مختلطة|حساسة|عادية)|(?:جميع|لكل)\s+أنواع\s+البشرة|نوع البشرة/i },
  { id: "key_actives", label: "Key active ingredients", pattern: /keratin|argan|hyaluronic|niacinamide|retinol|vitamin\s?[a-e]\b|collagen|biotin|salicylic|ceramide|shea|كيراتين|أرجان|ارجان|هيالورونيك|نياسيناميد|ريتينول|فيتامين|كولاجين|بيوتين|سيراميد|شيا/i },
  { id: "sulfate_free", label: "Sulfate-free", pattern: /sul(?:f|ph)ate[\s-]*free|no sul(?:f|ph)ates?|(?:بدون|خال[يٍ]?\s+من)\s+(?:ال)?سلفات/i },
  { id: "paraben_free", label: "Paraben-free", pattern: /paraben[\s-]*free|no parabens?|(?:بدون|خال[يٍ]?\s+من)\s+(?:ال)?بارابين/i },
  { id: "silicone_free", label: "Silicone-free", pattern: /silicone[\s-]*free|no silicones?|(?:بدون|خال[يٍ]?\s+من)\s+(?:ال)?سيليكون/i },
  { id: "fragrance_free", label: "Fragrance-free", pattern: /fragrance[\s-]*free|unscented|(?:بدون|خال[يٍ]?\s+من)\s+(?:ال)?(?:عطر|عطور)/i },
  { id: "cruelty_free", label: "Cruelty-free", pattern: /cruelty[\s-]*free|not tested on animals|(?:لم يتم|غير)\s+(?:اختباره|مختبر|مختبرة)\s+على\s+الحيوانات/i },
  { id: "vegan", label: "Vegan", pattern: /\bvegan\b|نباتي/i },
  { id: "halal", label: "Halal", pattern: /\bhalal\b|حلال/i },
  { id: "natural", label: "Natural / organic", pattern: /\borganic\b|\bnatural\b|عضوي|طبيعي/i },
  { id: "dermatologist", label: "Dermatologically tested", pattern: /dermatolog|أطباء (?:ال)?جلد|طبيب (?:ال)?جلد|مختبر(?:ة)? (?:من قبل|تحت إشراف)/i },
  { id: "spf", label: "Sun protection (SPF)", pattern: /\bspf\b|sun protection|واقي (?:من )?الشمس|حماية من (?:أشعة )?الشمس/i },
  { id: "origin", label: "Country of origin", pattern: /made in|country of origin|صنع في|صُنع في|بلد المنشأ|المنشأ/i },
  { id: "warnings", label: "Warnings / precautions", pattern: /warning|caution|precautions|avoid contact with (?:the )?eyes|تحذير|تحذيرات|احتياطات/i },
];

export function detectAttributes(text: string): Set<string> {
  return new Set(CONTENT_ATTRIBUTES.filter((a) => a.pattern.test(text)).map((a) => a.id));
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

import { median, normalizeArabic, termCounts, tokenize } from "@/lib/services/content/text-analysis";

export type ReviewSentiment = "positive" | "neutral" | "negative";

export type ReviewThemeId =
  | "price"
  | "delivery"
  | "packaging"
  | "authenticity"
  | "scent"
  | "texture"
  | "results"
  | "irritation"
  | "hair_loss"
  | "customer_service";

export interface ReviewThemeDef {
  id: ReviewThemeId;
  label: string;
  /** Word / phrase patterns in English and Arabic (already lowercased / normalized where needed). */
  patterns: RegExp;
}

export const REVIEW_THEMES: ReviewThemeDef[] = [
  {
    id: "price",
    label: "Price / value",
    patterns:
      /\b(?:price|priced|pricing|expensive|cheap|cheaper|costly|value|worth|overpriced|affordable|pricey)\b|سعر|اسعار|غالي|غالية|رخيص|رخيصة|قيمة|يستاهل|مكلف|رخيصه|غاليه/,
  },
  {
    id: "delivery",
    label: "Delivery / shipping",
    patterns:
      /\b(?:delivery|shipping|shipped|arrived|courier|late|delay|delays|fast shipping|slow shipping)\b|توصيل|التوصيل|شحن|الشحن|وصل|وصول|متأخر|تأخير|سريع/,
  },
  {
    id: "packaging",
    label: "Packaging",
    patterns:
      /\b(?:packaging|package|packed|box|bottle|leak|leaking|damaged|seal|sealed|broken)\b|تغليف|التغليف|عبوه|العبوه|علبه|تسريب|تالف|مفتوح|ختم|مكسور|مكسوره/,
  },
  {
    id: "authenticity",
    label: "Authenticity / original",
    patterns:
      /\b(?:authentic|original|genuine|fake|counterfeit|replica|legit)\b|اصلي|أصلي|اصليه|أصلية|تقليد|مقلد|مقلدة|مغشوش|حقيقي/,
  },
  {
    id: "scent",
    label: "Scent / fragrance",
    patterns:
      /\b(?:scent|smell|smells|fragrance|perfume|odour|odor|aroma)\b|رائحه|رائحة|عطر|عطور|ريحه|ريحة|نفاذ|فوحان/,
  },
  {
    id: "texture",
    label: "Texture / feel",
    patterns:
      /\b(?:texture|creamy|thick|thin|sticky|greasy|silky|smooth|lightweight|heavy|oily|dry touch|white cast)\b|قوام|ملمس|ثقيل|خفيف|لزج|دهني|دهنيه|ناعم|كريمي|ينشف|بينشف|ناشف|علامات بيض|بيضاء|يعرق|رؤوس السود/,
  },
  {
    id: "results",
    label: "Results / effectiveness",
    patterns:
      /\b(?:results?|effective|effectiveness|works?|working|difference|improved?|improvement|soft|shiny|shine|hydrated?|moisturiz)\b|نتيجه|نتائج|فعاليه|فعال|فرق|تحسن|ناعم|لمعان|ترطيب|تحف|حمايه|حمايت|مسام|منفعش|ما نفعش/,
  },
  {
    id: "irritation",
    label: "Irritation / allergy",
    patterns:
      /\b(?:irritat|allergy|allergic|itch|itchy|burn|burning|rash|sensitive|reaction|sting|breakout|break out|prick)\b|حساسيه|تهيج|حكه|حرق|احمرار|تفاعل|حساس|بريك|وخز/,
  },
  {
    id: "hair_loss",
    label: "Hair loss",
    patterns:
      /\b(?:hair\s*loss|shedding|fall(?:ing)?\s*out|bald)\b|تساقط|يسقط|سقط|صلع|كثافة\s+الشعر/,
  },
  {
    id: "customer_service",
    label: "Customer service",
    patterns:
      /\b(?:customer\s*service|support|refund|return|exchange|response|helpful|rude)\b|خدمه\s+العملاء|خدمة\s+العملاء|دعم|استرجاع|استبدال|رد|موظف/,
  },
];

export const REVIEW_THEME_LABELS: Record<ReviewThemeId, string> = Object.fromEntries(
  REVIEW_THEMES.map((t) => [t.id, t.label]),
) as Record<ReviewThemeId, string>;

const POSITIVE_WORDS = new Set(
  [
    "good",
    "great",
    "excellent",
    "amazing",
    "love",
    "loved",
    "best",
    "perfect",
    "wonderful",
    "fantastic",
    "awesome",
    "nice",
    "happy",
    "recommend",
    "recommended",
    "soft",
    "shiny",
    "fast",
    "worth",
    "beautiful",
    "ممتاز",
    "ممتازة",
    "رائع",
    "رائعة",
    "جميل",
    "جميلة",
    "حلو",
    "حلوة",
    "احسن",
    "أفضل",
    "افضل",
    "انصح",
    "أنصح",
    "ناعم",
    "ناعمة",
    "لمعان",
    "سريع",
    "سريعة",
    "يستاهل",
    "مرضي",
    "راضية",
    "راضي",
  ].map((w) => normalizeArabic(w.toLowerCase())),
);

const NEGATIVE_WORDS = new Set(
  [
    "bad",
    "poor",
    "terrible",
    "awful",
    "worst",
    "hate",
    "hated",
    "disappointing",
    "disappointed",
    "useless",
    "waste",
    "fake",
    "damaged",
    "broken",
    "late",
    "slow",
    "expensive",
    "overpriced",
    "itchy",
    "irritating",
    "سيء",
    "سيئ",
    "سيئة",
    "فظيع",
    "فظيعة",
    "مخيب",
    "مخيبة",
    "غالي",
    "غالية",
    "تقليد",
    "مقلد",
    "تالف",
    "متأخر",
    "بطيء",
    "حكة",
    "تهيج",
    "ما انصح",
    "ماأنصح",
    "لا انصح",
    "لا أنصح",
    "فاشل",
    "فاشلة",
  ].map((w) => normalizeArabic(w.toLowerCase())),
);

export interface AnalyzableReview {
  id?: string;
  rating: number | null;
  text: string;
  language?: string | null;
}

export function sentimentFromRating(rating: number | null): ReviewSentiment | null {
  if (rating == null || !Number.isFinite(rating)) return null;
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

/** Lexicon score over tokenized text. Positive when more positive words than negative. */
export function sentimentFromText(text: string): ReviewSentiment {
  const tokens = tokenize(text).map((t) => normalizeArabic(t.toLowerCase()));
  let pos = 0;
  let neg = 0;
  for (const token of tokens) {
    if (POSITIVE_WORDS.has(token)) pos += 1;
    if (NEGATIVE_WORDS.has(token)) neg += 1;
  }
  // Phrase-level Arabic "لا أنصح" / "ما أنصح"
  const normalized = normalizeArabic(text.toLowerCase());
  if (/لا\s*انصح|ما\s*انصح/.test(normalized)) neg += 2;

  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

export function analyzeSentiment(review: AnalyzableReview): ReviewSentiment {
  return sentimentFromRating(review.rating) ?? sentimentFromText(review.text);
}

export function detectThemes(text: string): ReviewThemeId[] {
  const haystack = normalizeArabic(text.toLowerCase());
  return REVIEW_THEMES.filter((t) => t.patterns.test(haystack)).map((t) => t.id);
}

export interface ThemeStats {
  themeId: ReviewThemeId;
  label: string;
  mentions: number;
  positive: number;
  neutral: number;
  negative: number;
  /** (positive - negative) / mentions, -1..1. */
  netSentiment: number;
}

export interface KeywordStat {
  term: string;
  count: number;
}

export interface ReviewAnalysisSummary {
  total: number;
  withRating: number;
  averageRating: number | null;
  sentiment: { positive: number; neutral: number; negative: number };
  positivePercentage: number | null;
  negativePercentage: number | null;
  themes: ThemeStats[];
  positiveKeywords: KeywordStat[];
  negativeKeywords: KeywordStat[];
}

function emptySummary(): ReviewAnalysisSummary {
  return {
    total: 0,
    withRating: 0,
    averageRating: null,
    sentiment: { positive: 0, neutral: 0, negative: 0 },
    positivePercentage: null,
    negativePercentage: null,
    themes: [],
    positiveKeywords: [],
    negativeKeywords: [],
  };
}

function topTerms(texts: string[], limit = 8): KeywordStat[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const [term, n] of termCounts(text)) {
      if (term.includes(" ")) continue; // unigrams only for review keywords
      counts.set(term, (counts.get(term) ?? 0) + n);
    }
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

/** Aggregates sentiment, themes and keywords across a set of reviews. */
export function summarizeReviews(reviews: AnalyzableReview[]): ReviewAnalysisSummary {
  if (reviews.length === 0) return emptySummary();

  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  const ratings: number[] = [];
  const themeMap = new Map<ReviewThemeId, ThemeStats>();
  const positiveTexts: string[] = [];
  const negativeTexts: string[] = [];

  for (const theme of REVIEW_THEMES) {
    themeMap.set(theme.id, {
      themeId: theme.id,
      label: theme.label,
      mentions: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      netSentiment: 0,
    });
  }

  for (const review of reviews) {
    const s = analyzeSentiment(review);
    sentiment[s] += 1;
    if (review.rating != null && Number.isFinite(review.rating)) ratings.push(review.rating);
    if (s === "positive") positiveTexts.push(review.text);
    if (s === "negative") negativeTexts.push(review.text);

    for (const themeId of detectThemes(review.text)) {
      const stats = themeMap.get(themeId)!;
      stats.mentions += 1;
      stats[s] += 1;
    }
  }

  const themes = [...themeMap.values()]
    .filter((t) => t.mentions > 0)
    .map((t) => ({
      ...t,
      netSentiment: t.mentions === 0 ? 0 : (t.positive - t.negative) / t.mentions,
    }))
    .sort((a, b) => b.mentions - a.mentions || a.label.localeCompare(b.label));

  const total = reviews.length;
  return {
    total,
    withRating: ratings.length,
    averageRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    sentiment,
    positivePercentage: Math.round((sentiment.positive / total) * 100),
    negativePercentage: Math.round((sentiment.negative / total) * 100),
    themes,
    positiveKeywords: topTerms(positiveTexts),
    negativeKeywords: topTerms(negativeTexts),
  };
}

export function topPraisedThemes(themes: ThemeStats[], limit = 3): ThemeStats[] {
  return [...themes]
    .filter((t) => t.mentions >= 1 && t.positive >= t.negative)
    .sort((a, b) => b.positive - a.positive || b.netSentiment - a.netSentiment)
    .slice(0, limit);
}

export function topComplainedThemes(themes: ThemeStats[], limit = 3): ThemeStats[] {
  return [...themes]
    .filter((t) => t.mentions >= 1 && t.negative >= t.positive)
    .sort((a, b) => b.negative - a.negative || a.netSentiment - b.netSentiment)
    .slice(0, limit);
}

export { median };

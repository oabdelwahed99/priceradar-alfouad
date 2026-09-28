import { describe, expect, it } from "vitest";
import {
  buildKeywordGap,
  countWords,
  detectAttributes,
  median,
  minCompetitorsForTerm,
  normalizeArabic,
  termCounts,
  textSimilarity,
  tokenize,
} from "./text-analysis";

describe("tokenize", () => {
  it("lowercases, drops stopwords, short Latin tokens and numbers", () => {
    expect(tokenize("The Argan OIL shampoo is for dry hair, 400 ml")).toEqual(["argan", "oil", "shampoo", "dry", "hair"]);
  });

  it("drops commerce boilerplate", () => {
    expect(tokenize("Add to cart - fast shipping - argan")).toEqual(["fast", "argan"]);
  });

  it("normalizes Arabic letter variants, diacritics and the definite article", () => {
    expect(normalizeArabic("أإآ ى ة")).toBe("ااا ي ه");
    expect(tokenize("الشَّعر شعر")).toEqual(["شعر", "شعر"]);
    expect(tokenize("للشعر والبشرة")).toEqual(["شعر", "بشره"]);
    expect(tokenize("في من على")).toEqual([]);
  });
});

describe("termCounts", () => {
  it("counts unigrams and bigrams without bridging stopwords", () => {
    const counts = termCounts("Sulfate free shampoo. Sulfate free and gentle");
    expect(counts.get("sulfate free")).toBe(2);
    expect(counts.get("shampoo")).toBe(1);
    expect(counts.has("free gentle")).toBe(false);
  });
});

describe("countWords", () => {
  it("counts words in any script", () => {
    expect(countWords("Argan oil شامبو بزيت")).toBe(4);
    expect(countWords(null)).toBe(0);
  });
});

describe("buildKeywordGap", () => {
  const competitors = [
    termCounts("argan oil shampoo sulfate free keratin"),
    termCounts("argan oil shampoo sulfate free curly hair"),
    termCounts("argan oil conditioner keratin"),
  ];

  it("requires terms to appear on several competitor pages", () => {
    expect(minCompetitorsForTerm(1)).toBe(1);
    expect(minCompetitorsForTerm(2)).toBe(1);
    expect(minCompetitorsForTerm(3)).toBe(2);
    expect(minCompetitorsForTerm(10)).toBe(3);
  });

  it("lists market terms missing from your page, most widely used first", () => {
    const gap = buildKeywordGap(termCounts("argan oil shampoo for my salon salon"), competitors);
    expect(gap.minCompetitors).toBe(2);
    const missing = gap.missing.map((t) => t.term);
    expect(missing).toContain("sulfate free");
    expect(missing).toContain("keratin");
    expect(missing).not.toContain("curly hair");
    expect(gap.shared.map((t) => t.term)).toEqual(expect.arrayContaining(["argan", "argan oil", "shampoo"]));
    expect(gap.shared[0].competitorCount).toBe(3);
    expect(gap.uniqueToYou).toEqual([{ term: "salon", ownOccurrences: 2 }]);
  });

  it("treats every market term as missing when your page is unknown", () => {
    const gap = buildKeywordGap(null, competitors);
    expect(gap.shared).toEqual([]);
    expect(gap.missing.every((t) => t.ownOccurrences === 0)).toBe(true);
  });
});

describe("textSimilarity", () => {
  const base =
    "This nourishing argan oil shampoo gently cleanses dry damaged hair restoring natural shine softness strength moisture balance without heavy residue leaving hair smooth manageable fragrant";

  it("scores identical text 100 and unrelated text low", () => {
    expect(textSimilarity(base, base)).toBe(100);
    const other =
      "Lightweight mineral sunscreen protects sensitive facial skin against sunburn blue light pollution while hydrating calming redness under makeup daily wear matte finish reef safe";
    expect(textSimilarity(base, other)).toBeLessThan(10);
  });

  it("returns null for short or missing text", () => {
    expect(textSimilarity("argan oil", base)).toBeNull();
    expect(textSimilarity(null, base)).toBeNull();
  });
});

describe("detectAttributes", () => {
  it("finds English and Arabic product facts", () => {
    const en = detectAttributes("Sulfate-free, cruelty free. Ingredients: Aqua, Argan oil. How to use: apply. 250ml. For curly hair.");
    expect([...en]).toEqual(expect.arrayContaining(["sulfate_free", "cruelty_free", "ingredients", "how_to_use", "size", "hair_type", "key_actives"]));
    const ar = detectAttributes("شامبو بدون سلفات، حلال، طريقة الاستخدام: يوضع على الشعر. 400 مل. صنع في فرنسا");
    expect([...ar]).toEqual(expect.arrayContaining(["sulfate_free", "halal", "how_to_use", "size", "origin"]));
    expect(ar.has("vegan")).toBe(false);
  });
});

describe("median", () => {
  it("handles odd, even and empty inputs", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { buildPriceMatrix } from "../matrix/price-matrix.service";
import { competitorDifferencePercentage } from "../pricing/pricing-analysis.service";

const id = () => new Types.ObjectId();

describe("brand matrix uses official store as reference", () => {
  it("puts the brand official store first and computes gaps vs its price", () => {
    const productId = id();
    const officialId = id();
    const noonId = id();
    const officialRetailer = {
      _id: id(),
      name: "Dermaelle Official",
      domain: "e-dermaelle.com",
      isOwnStore: true,
      isBrandStore: true,
    };
    const noonRetailer = {
      _id: id(),
      name: "Noon",
      domain: "noon.com",
      isOwnStore: false,
      isBrandStore: false,
    };
    const at = new Date();
    const { columns, rows } = buildPriceMatrix({
      products: [
        {
          _id: productId,
          name: "Dermaelle Serum 30ml",
          brand: "Dermaelle",
          size: "30ml",
          currency: "EGP",
          isDemo: false,
          latestAnalysis: {
            status: "OK",
            ownPrice: 690,
            currency: "EGP",
            marketMinimum: 414,
            marketMaximum: 414,
            marketAverage: 414,
            marketMedian: 414,
            gapPercentage: 66.67,
            position: "OVERPRICED",
            suggestedPrice: 676.2,
            competitorCount: 1,
            successfulCompetitorCount: 1,
            computedAt: at,
          },
        },
      ],
      retailers: [noonRetailer, officialRetailer],
      sources: [
        {
          _id: noonId,
          productId,
          retailerId: noonRetailer._id,
          url: "https://noon.com/p",
          isOwnStore: false,
          sortOrder: 1,
          scrapingStatus: "success",
          lastError: null,
        },
        {
          _id: officialId,
          productId,
          retailerId: officialRetailer._id,
          url: "https://e-dermaelle.com/p",
          isOwnStore: true,
          sortOrder: 0,
          scrapingStatus: "success",
          lastError: null,
        },
      ],
      latest: new Map([
        [String(officialId), { price: 690, currency: "EGP", availability: "in_stock" as const, scrapedAt: at, origin: "manual" as const }],
        [String(noonId), { price: 414, currency: "EGP", availability: "in_stock" as const, scrapedAt: at, origin: "manual" as const }],
      ]),
    });

    expect(columns[0]).toMatchObject({ name: "Dermaelle Official", isOwnStore: true, isBrandStore: true });
    expect(rows[0].cells[String(noonRetailer._id)].differencePercentage).toBe(
      competitorDifferencePercentage(414, 690),
    );
  });
});

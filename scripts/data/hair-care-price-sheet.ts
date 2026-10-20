import type { PriceSheet } from "@/lib/services/imports/price-sheet-import.service";

/**
 * Price sheet (EGP), transcribed from the team's comparison spreadsheet.
 * A cell with a price but `url: null` had its link cut off in the export: paste the full link
 * and re-run `pnpm import:sheet` to add it. A row `category` overrides the sheet category.
 */
export const hairCarePriceSheet: PriceSheet = {
  currency: "EGP",
  category: "Hair care",
  stores: [
    { key: "alfouad", name: "Al Fouad Pharmacies", isOwnStore: true },
    { key: "noon", name: "Noon" },
    { key: "bloom", name: "Bloom Pharmacy" },
    { key: "tay", name: "Tay Pharmacies" },
    { key: "seif", name: "Seif Online" },
    { key: "delmar", name: "Delmar & Attalla" },
    { key: "amazon", name: "Amazon Egypt" },
  ],
  rows: [
    {
      name: "Capixy Hair Intense Spray – 125ml",
      brand: "Capixy",
      size: "125ml",
      cells: {
        alfouad: { url: "https://alfouadpharmacies.com/en/products/capixy-hair-intense-spray-125ml", price: 700 },
        noon: {
          url: "https://www.noon.com/egypt-en/capixy-hair-fertilizer-intense-tonic-spray-white-125ml/ZB5CBB5B73370A25B80F9Z/p/?o=d598b1a85b3b157d",
        },
        bloom: { url: "https://www.bloompharmacy.com/products/capixy-hair-fertilizer-intense-tonic-spray-125ml", price: 560 },
        tay: { url: "https://taypharmacies.com/product/897575/capixy-intense-tonic-spray-125ml-2", price: 490 },
        seif: { url: null, price: 490 },
        amazon: { url: "https://www.amazon.eg/-/en/Capixy-Fertlizer-Intense-Tonic-Spray/dp/B0B3DQ2655", price: 446 },
      },
    },
    {
      name: "Clary Hair Leave in Cream 300gm",
      brand: "Clary",
      size: "300gm",
      cells: {
        alfouad: { url: "https://alfouadpharmacies.com/en/products/clary-hair-leave-in-cream-300gm", price: 340 },
        noon: { url: "https://www.noon.com/egypt-en/leave-in-cream-300-gm/Z106C5FA40605EC7D50E8Z/p/", price: 255 },
        bloom: { url: "https://www.bloompharmacy.com/products/clary-leave-in-cream-300gm?variant=48641346306356", price: 340 },
        tay: { url: "https://taypharmacies.com/product/901217/clary-leave-in-cream-300gm", price: 340 },
        seif: { url: "https://seif-online.com/en/clary-hair-fall-control-leave-in-cream-300-gm", price: 340 },
        delmar: { url: "https://www.delmar-attalla.com/products/clary-leave-in-cream-300-gm/143483", price: 340 },
        amazon: { url: "https://www.amazon.eg/-/en/Clary-Hair-Leave-Cream-300/dp/B0CVQ8JKGT?th=1", price: 225 },
      },
    },
    {
      name: "L'Oréal Paris Prodigy Permanent Hair Colour 6.60 Ruby Red",
      brand: "L'Oréal Paris",
      cells: {
        alfouad: { url: "https://alfouadpharmacies.com/en/products/loreal-prodigy-660-ruby-red", price: 450 },
        noon: {
          url: "https://www.noon.com/egypt-ar/loreal-paris-prodigy-permanent-oil-hair-color-6-60-intense-red-182-ml/Z1CF309C00FAD8E31095EZ/p/?o=z1cf309c00fad8e31095ez-1",
          price: 531,
        },
        bloom: { url: "https://www.bloompharmacy.com/products/loreal-prodigy-hair-color?variant=45444784193844", price: 450 },
        tay: {
          url: "https://taypharmacies.com/product/215321/loreal-prodigy-6-6-%D8%A7%D8%AD%D9%85%D8%B1-%D8%BA%D8%A7%D9%85%D9%82",
          price: 450,
        },
        seif: { url: null, price: 450 },
        delmar: { url: "https://www.delmar-attalla.com/products/loreal-prodigy-66-hair-colour/110938", price: 450 },
        amazon: { url: null, price: 389 },
      },
    },
    {
      name: "Karseell Maca power Essence Repair Collagen Hair Mask - 500ml",
      brand: "Karseell",
      size: "500ml",
      cells: {
        alfouad: {
          url: "https://alfouadpharmacies.com/en/products/karseell-maca-power-essence-repair-collagen-hair-mask-500ml",
          price: 990,
        },
        noon: {
          url: "https://www.noon.com/egypt-en/collagen-hair-treatment-deep-repair-conditioning-argan-oil-collagen-hair-mask-essence-for-dry-damaged-hair-16-90-oz-500ml/ZF362BC8E23A984EF2D9DZ/p/?o=zf362bc8e23a984ef2d9dz-1",
          price: 719,
        },
        bloom: {
          url: "https://www.bloompharmacy.com/products/karseell-maca-power-essence-repair-collagen-hair-mask-500ml?variant=48305795105076",
          price: 890,
        },
        tay: { url: "https://taypharmacies.com/product/983995/karseell-hair-mask-maca-power-collagen-500ml", price: 950 },
        seif: { url: "https://seif-online.com/ar/karseell-hair-mask-in-jar-500ml-0180", price: 990 },
        delmar: { url: "https://www.delmar-attalla.com/products/karseell-collagen-hair-mask-500-ml/147404", outOfStock: true },
        amazon: { url: "https://www.amazon.eg/dp/B0D2QV8F7Z", price: 704 },
      },
    },
    {
      name: "VICHY Dercos R.E.G.E.N Booster Hair Serum 90ml",
      brand: "Vichy",
      size: "90ml",
      cells: {
        alfouad: { url: "https://alfouadpharmacies.com/en/products/vichy-dercos-r-e-g-e-n-booster-hair-serum-90ml", price: 2700 },
        noon: {
          url: "https://www.noon.com/egypt-en/dercos-aminexil-clinical-regen-booster-serum-designed-for-hairloss-90ml/N70249904V/p/?o=b6e74a2d26798afe",
          price: 2403,
        },
        bloom: { url: "https://www.bloompharmacy.com/products/vichy-dercos-aminexil-clinical-r-e-g-e-n-booster-90ml", price: 2700 },
        tay: { url: "https://taypharmacies.com/product/1294764/vichy-dercos-aminexil-clinical-r-e-g-e-n-booster-90ml", price: 2700 },
        seif: { url: "https://seif-online.com/ar/vichy-dercos-aminexil-clinical-regen-booster-hair-serum-90ml", price: 2700 },
        delmar: { url: "https://www.delmar-attalla.com/products/vichy-dercos-aminexil-regen-hair-serum-90-ml/146545", price: 2700 },
        amazon: { url: "https://www.amazon.eg/dp/B0FH5FKY2W", price: 2455 },
      },
    },
    {
      name: "L'Oréal Elvive Extraordinary Oil Hair Oil 100ml",
      brand: "L'Oréal Paris",
      size: "100ml",
      cells: {
        alfouad: { url: "https://alfouadpharmacies.com/en/products/loreal-elvive-extraord-hair-oil-100ml", price: 550 },
        noon: {
          url: "https://www.noon.com/egypt-en/elvive-extraordinary-sublime-hair-oil-serum-clear-100ml/N11266173A/p/?o=b633bf2047387fdb",
          price: 415,
        },
        bloom: {
          url: "https://www.bloompharmacy.com/products/loreal-elvive-extraordinary-oil-for-dry-hair?variant=45454084178228",
          price: 550,
        },
        tay: { url: "https://taypharmacies.com/product/215384/loreal-extraordinary-oil-dry-hair-serum-100ml", price: 550 },
        amazon: { url: "https://www.amazon.eg/dp/B01FN772MS", price: 395 },
      },
    },
    {
      name: "Vichy Dercos Densi-Solutions Hair Mass Creator - 100ml",
      brand: "Vichy",
      size: "100ml",
      cells: {
        alfouad: { url: "https://alfouadpharmacies.com/en/products/vichy-dercos-densi-solutions-hair-spray-100ml", price: 2380 },
        noon: {
          url: "https://www.noon.com/egypt-en/dercos-densi-solutions-hair-thickening-treatment-for-weak-and-thinning-hair-100ml/N13707591A/p/?o=ce35966de7a0768b",
          price: 1871,
        },
        bloom: { url: "https://www.bloompharmacy.com/products/vichy-densi-solutions-hair-mass-recreating-concentrate-100ml", price: 2094 },
        tay: { url: "https://taypharmacies.com/product/216738/vichy-dercos-spray-densi-thinningweak-hair", price: 2380 },
        seif: { url: null, price: 2380 },
        delmar: { url: "https://www.delmar-attalla.com/products/vichy-dercos-densi-solution-hair-lotion-100-ml/130602", price: 2380 },
        amazon: { url: "https://www.amazon.eg/dp/B073ZJDJP9", price: 2378 },
      },
    },
    {
      name: "Clary Booster Shot 30ml",
      brand: "Clary",
      size: "30ml",
      cells: {
        alfouad: { url: "https://alfouadpharmacies.com/en/products/clary-booster-shot-30ml", price: 500 },
        noon: { url: "https://www.noon.com/egypt-en/clary-booster-shot/ZCF8120AC9A4C28109FC0Z/p/?o=zcf8120ac9a4c28109fc0z-1", price: 375 },
        bloom: { url: "https://www.bloompharmacy.com/products/clary-hair-fall-control-booster-shot-30ml", price: 500 },
        tay: { url: "https://taypharmacies.com/product/888798/clary-booster-shot-intensive-repair-30ml", price: 500 },
        seif: { url: "https://seif-online.com/ar/clary-hair-fall-control-booster-shot-30-ml", price: 500 },
        delmar: { url: "https://www.delmar-attalla.com/products/clary-hair-fall-control-booster-shot-30-ml/140971", price: 500 },
        amazon: { url: "https://www.amazon.eg/dp/B0CRRXRS8W", price: 375 },
      },
    },
    {
      name: "L'Oréal Professionnel Absolut Repair Shampoo 300ml",
      brand: "L'Oréal Professionnel",
      size: "300ml",
      cells: {
        alfouad: { url: "https://alfouadpharmacies.com/en/products/loreal-prof-absolut-repair-shampoo-300ml", price: 1100 },
        noon: { url: "https://www.noon.com/egypt-en/absolut-repair-shampoo-300ml/N51035077A/p/?o=f0af27d6b4e2c1cf", price: 784 },
        bloom: {
          url: "https://www.bloompharmacy.com/products/l-oreal-professional-absolut-repair-quinoa-protein-shampoo-300ml",
          price: 895,
        },
        tay: { url: "https://taypharmacies.com/product/215529/loreal-absolut-repair-shampoo-300ml__trashed", price: 900 },
        amazon: { url: "https://www.amazon.eg/dp/B094DHJ3X3", price: 741 },
      },
    },
    {
      name: "L'Oréal Prof Serie Expert Absolut Repair Conditioner (200 ml)",
      brand: "L'Oréal Professionnel",
      size: "200ml",
      cells: {
        alfouad: { url: "https://alfouadpharmacies.com/en/products/loreal-prof-absolut-repair-conditioner-200ml", price: 1370 },
        noon: {
          url: "https://www.noon.com/egypt-en/seri-expert-absolut-repair-gold-conditioner-gold-200ml/N31748050A/p/?o=dff21a9125dc443c",
          price: 999.4,
        },
        bloom: {
          url: "https://www.bloompharmacy.com/products/l-oreal-professional-absolut-repair-gold-quinoa-protein-conditioner-200ml",
          price: 1150,
        },
        tay: { url: "https://taypharmacies.com/product/215532/loreal-absolut-repair-cond-200ml", price: 1207 },
        seif: { url: "https://seif-online.com/ar/loreal-serie-absolut-repair-cond-200ml", price: 1350 },
        delmar: { url: "https://www.delmar-attalla.com/products/loreal-absolut-repair-cond-200-ml-imp/111375", price: 1250 },
        amazon: { url: null, price: 945 },
      },
    },
    {
      name: "Dermaelle Glycolic Acid Toner - 350ml",
      brand: "Dermaelle",
      size: "350ml",
      category: "Skin care",
      cells: {
        alfouad: {
          url: "https://alfouadpharmacies.com/en/products/dermaelle-glycolic-acid-toner-350-ml",
          price: 250,
        },
        noon: {
          url: "https://www.noon.com/egypt-ar/dermaelle-gentle-exfoliating-radiance-glycolic-acid-toner-350ml/ZCF90116585B514D7D897Z/p/",
          price: 250,
        },
        tay: { url: "https://taypharmacies.com/product/1262137/dermaelle-glycolic-acid-toner-350ml", price: 440 },
        amazon: {
          url: "https://www.amazon.eg/-/en/Dermaelle-Gentle-Exfoliating-Radiance-Glycolic/dp/B0FV2XKRF2",
          price: 249,
        },
      },
    },
    {
      name: "Dermaelle Hyaluwhite Sensitive Area Cream 60ml",
      brand: "Dermaelle",
      size: "60ml",
      category: "Skin care",
      cells: {
        alfouad: { url: "https://alfouadpharmacies.com/en/products/dermaelle-hyaluwhite-sensitive-area-cream-60ml" },
        noon: {
          url: "https://www.noon.com/egypt-en/dermaelle-hyalu-white-sensitive-area-cream-60ml/ZB83E97E5DD4CE1453E26Z/p/",
          outOfStock: true,
        },
        tay: { url: "https://taypharmacies.com/product/958694/dermaelle-hyalu-white-sensitive-area-cream-60ml" },
        amazon: { url: "https://www.amazon.eg/-/en/Dermaelle-Hyalu-White-Sensitive-Cream/dp/B0DJZ979QC" },
      },
    },
    {
      name: "Dermaelle Skin Booster Serum 30ml",
      brand: "Dermaelle",
      size: "30ml",
      category: "Skin care",
      cells: {
        alfouad: { url: "https://alfouadpharmacies.com/en/products/dermaelle-advanc-skin-booster-serum-30-ml" },
        noon: {
          url: "https://www.noon.com/egypt-ar/dermaelle-advanced-skinbooster-microneedling-serum-30ml/Z57963152627092705BD6Z/p/",
          outOfStock: true,
        },
        tay: { url: "https://taypharmacies.com/product/1262135/dermaelle-advanced-skin-booster-serum-30ml" },
        delmar: { url: "https://www.delmar-attalla.com/products/dermaelle-skin-booster-advanced-serum-30-ml/145972" },
        amazon: {
          url: "https://www.amazon.eg/%D8%B3%D9%8A%D8%B1%D9%88%D9%85-%D8%AF%D9%8A%D8%B1%D9%85%D8%A7%D9%8A%D9%84-%D8%A7%D8%AF%D9%81%D8%A7%D9%86%D8%B3%D8%AF-%D8%A8%D8%A7%D9%84%D8%A5%D8%A8%D8%B1-%D8%A7%D9%84%D8%AF%D9%82%D9%8A%D9%82%D8%A9/dp/B0FV2WLN7B",
        },
      },
    },
    {
      name: "Mood Flower Bliss (Splash+Hand+Shower+Milk)",
      brand: "Mood",
      category: "Body care",
      cells: {
        alfouad: { url: "https://alfouadpharmacies.com/en/products/mood-set-flower-bliss-splash-hand-shower-milk" },
        noon: { url: "https://www.noon.com/egypt-en/all-over-flower-bliss-set/Z7F98A545E2FE0906CBA3Z/p/", outOfStock: true },
        amazon: { url: "https://www.amazon.eg/-/en/Mood-All-Over-Flower-Bliss-Women/dp/B0G24NHMDC" },
      },
    },
  ],
};

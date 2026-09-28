const DEFAULT_FRACTION_DIGITS = 2;
const digitsCache = new Map<string, number>();

/** Minor-unit digits for an ISO currency (USD 2, JPY 0, KWD 3). Falls back to 2. */
export function currencyFractionDigits(currency: string | null | undefined): number {
  if (!currency) return DEFAULT_FRACTION_DIGITS;
  const code = currency.toUpperCase();
  const cached = digitsCache.get(code);
  if (cached !== undefined) return cached;
  let digits = DEFAULT_FRACTION_DIGITS;
  try {
    digits =
      new Intl.NumberFormat("en-US", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ??
      DEFAULT_FRACTION_DIGITS;
  } catch {
    digits = DEFAULT_FRACTION_DIGITS;
  }
  digitsCache.set(code, digits);
  return digits;
}

/**
 * Decimal rounding, half away from zero, without binary floating-point drift
 * (e.g. 35 * 0.98 -> 34.3, -3.125 -> -3.13).
 */
export function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const shifted = Math.round(Number(`${Math.abs(value)}e${digits}`));
  const result = sign * Number(`${shifted}e-${digits}`);
  return Object.is(result, -0) ? 0 : result;
}

export function roundForCurrency(value: number, currency: string | null | undefined): number {
  return roundTo(value, currencyFractionDigits(currency));
}

export function roundPercentage(value: number): number {
  return roundTo(value, 2);
}

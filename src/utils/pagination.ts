/** Page numbers to show: first, last, and a window around the current page, with gaps as null. */
export function pageWindow(page: number, totalPages: number, radius = 1): (number | null)[] {
  if (totalPages < 1) return [];
  const pages = new Set([1, totalPages]);
  for (let p = page - radius; p <= page + radius; p++) if (p >= 1 && p <= totalPages) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

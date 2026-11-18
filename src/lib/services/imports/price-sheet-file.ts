/**
 * Edits prices inside a price sheet source file (scripts/data/*-price-sheet.ts) as text,
 * so the file keeps its layout and comments. Cells are `key: { url: "...", price: N, ... }`.
 */

/** Rounds to cents so scraped floats (e.g. 219.34000001) compare and print cleanly. */
export function roundPrice(price: number): number {
  return Math.round(price * 100) / 100;
}

/**
 * Sets `price` on every cell whose `url` is `url`. Adds the field when the cell has none.
 * Returns the source unchanged when the url is not found.
 */
export function setCellPrice(source: string, url: string, price: number): string {
  const literal = `url: ${JSON.stringify(url)}`;
  const value = String(roundPrice(price));
  let result = source;
  let from = 0;

  for (;;) {
    const at = result.indexOf(literal, from);
    if (at === -1) return result;
    const open = result.lastIndexOf("{", at);
    const close = result.indexOf("}", at);
    if (open === -1 || close === -1) return result;

    const cell = result.slice(open, close);
    let updated: string;
    if (/\bprice:\s*[\d.]+/.test(cell)) {
      updated = cell.replace(/\bprice:\s*[\d.]+/, `price: ${value}`);
    } else {
      const urlEnd = at - open + literal.length;
      const lineStart = result.lastIndexOf("\n", at) + 1;
      const indent = result.slice(lineStart, at).match(/^\s*/)?.[0] ?? "";
      const multiline = cell.slice(urlEnd).startsWith(",\n");
      updated = multiline
        ? `${cell.slice(0, urlEnd + 1)}\n${indent}price: ${value},${cell.slice(urlEnd + 1)}`
        : `${cell.slice(0, urlEnd)}, price: ${value}${cell.slice(urlEnd)}`;
    }

    result = result.slice(0, open) + updated + result.slice(close);
    from = open + updated.length;
  }
}

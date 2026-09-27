// Parsing for Shopify storefront product JSON, shared by scripts/sync-prices.mjs
// (run with Node's type stripping) and the unit tests. No imports on purpose.
//
// Two storefront formats exist:
//   /products/<handle>.js   -> { title, variants: [{ id, title, price: 374 (cents) }] }
//   /products/<handle>.json -> { product: { title, variants: [{ id, title, price: "3.74" }] } }

export interface SyncedVariant {
  id: string;
  title: string;
  price: number;
  compareAt: number | null;
  available: boolean;
  sku: string | null;
}

export interface SyncedProduct {
  title: string;
  variants: SyncedVariant[];
}

type Raw = Record<string, unknown>;

function money(v: unknown, centsIfNumber: boolean): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return centsIfNumber ? Math.round(v) / 100 : v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function parseShopifyProduct(payload: unknown, format: 'js' | 'json'): SyncedProduct | null {
  if (!payload || typeof payload !== 'object') return null;
  const product = (format === 'json' ? (payload as Raw).product : payload) as Raw | undefined;
  if (!product || typeof product !== 'object' || !Array.isArray(product.variants)) return null;
  const variants: SyncedVariant[] = [];
  for (const item of product.variants as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const v = item as Raw;
    const price = money(v.price, format === 'js');
    if (v.id === undefined || v.id === null || price === null) continue;
    const options = [v.option1, v.option2, v.option3].filter((o): o is string => typeof o === 'string' && o !== 'Default Title');
    const title = typeof v.title === 'string' && v.title !== 'Default Title' ? v.title : options.join(' / ');
    variants.push({
      id: String(v.id),
      title,
      price,
      compareAt: money(v.compare_at_price, format === 'js'),
      available: v.available !== false,
      sku: typeof v.sku === 'string' && v.sku ? v.sku : null,
    });
  }
  return { title: typeof product.title === 'string' ? product.title : '', variants };
}

/** Product handles referenced by the catalog source (P('handle'), bundle(id, 'handle'), kit(id, 'handle')). */
export function handlesInCatalogSource(source: string): string[] {
  const found = new Set<string>();
  for (const re of [/\bP\('([^']+)'\)/g, /\b(?:bundle|kit)\('[^']+',\s*'([^']+)'/g]) {
    for (const m of source.matchAll(re)) found.add(m[1]);
  }
  return [...found].sort();
}

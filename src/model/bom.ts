// Bill of materials, pricing, bundle suggestions and order export.

import {
  CATALOG_BY_ID,
  CATALOG_FOR_KIND,
  SHIPPING_FLAT,
  STORE,
  type PriceBasis,
  type Product,
  basePrice,
  isEstimate,
  priceKey,
} from '../catalog/catalog';
import { EMT } from '../catalog/emt';
import type { Analysis } from './analyze';
import type { CutPlan } from './cutlist';
import type { Design, Finish, Issue, PipeSize } from './types';
import { PIPE_SIZES } from './types';
import { formatMoney } from './units';

export type ToolChoice = 'none' | 'allen' | 'short' | 'long';

export interface OrderOptions {
  /** User-edited prices, keyed by priceKey(productId, size). Per purchase unit. */
  priceOverrides: Record<string, number>;
  tool: ToolChoice;
  cutter: boolean;
  /** One spare of every connector line. */
  spares: boolean;
  shipping: boolean;
  /** Bundle bought in place of single connectors, with how many of it. */
  bundle: { productId: string; qty: number } | null;
}

export const DEFAULT_ORDER: OrderOptions = {
  priceOverrides: {},
  tool: 'short',
  cutter: false,
  spares: false,
  shipping: true,
  bundle: null,
};

export type LineSource = 'design' | 'spare' | 'tool' | 'extra' | 'bundle' | 'pipe';

export interface BomLine {
  key: string;
  productId: string;
  name: string;
  size?: PipeSize;
  vendor: 'makerpipe' | 'local';
  group: Product['group'];
  source: LineSource;
  /** Pieces the design uses (before rounding up to packs). */
  needed: number;
  /** Purchase units: packs for packed items. */
  qty: number;
  pack: number;
  unitPrice: number | null;
  total: number | null;
  basis: PriceBasis | 'edited';
  estimate: boolean;
  note?: string;
  url: string;
  variantId?: string;
  /** The store lists this variant as sold out. */
  soldOut?: boolean;
}

export interface BundleSuggestion {
  productId: string;
  name: string;
  qty: number;
  cost: number;
  savings: number;
  /** Connectors left over after the build. */
  spare: number;
}

export interface Bom {
  lines: BomLine[];
  makerpipeSubtotal: number;
  localSubtotal: number;
  shipping: number;
  total: number;
  /** Lines whose price is unknown; they are not in the totals. */
  unpriced: BomLine[];
  bolts: number;
  connectorCount: number;
  pipeWeightLb: number;
  issues: Issue[];
  suggestion: BundleSuggestion | null;
}

export function priceFor(productId: string, size: PipeSize | undefined, overrides: Record<string, number>) {
  const p = CATALOG_BY_ID[productId];
  const key = priceKey(productId, size);
  if (key in overrides) return { price: overrides[key], basis: 'edited' as const, estimate: false };
  return { price: basePrice(p, size), basis: p.basis, estimate: isEstimate(p, size) || p.basis === 'unknown' };
}

function variantFor(p: Product, size: PipeSize | undefined, finish: Finish): string | undefined {
  const v = p.variants?.[size ?? 'any'] ?? p.variants?.any;
  return v?.[finish] ?? v?.any ?? v?.silver ?? v?.black;
}

const CONNECTOR_GROUPS = new Set(['connector', 'end']);

interface Need {
  productId: string;
  size?: PipeSize;
  needed: number;
  source: LineSource;
  note?: string;
}

/** Everything the design itself needs, before tools, bundles and extras. */
export function designNeeds(analysis: Analysis, plan: CutPlan): { needs: Need[]; issues: Issue[]; bolts: number } {
  const counts = new Map<string, Need>();
  const issues: Issue[] = [];
  let bolts = 0;
  const add = (productId: string, size: PipeSize | undefined, n: number) => {
    const key = priceKey(productId, size);
    const cur = counts.get(key);
    if (cur) cur.needed += n;
    else counts.set(key, { productId, size, needed: n, source: 'design' });
  };
  const offered = (p: Product, size: PipeSize, where: string) => {
    if (p.sizes && !p.sizes.includes(size)) {
      issues.push({
        level: 'warning',
        message: `The ${p.name} is not sold for ${EMT[size].label} (${p.sizes.map((s) => `${s}"`).join(', ')} only). ${where}`,
      });
    }
  };
  for (const c of analysis.connectors) {
    const p = CATALOG_FOR_KIND[c.kind];
    add(p.id, c.size, 1);
    bolts += p.bolts ?? 0;
    offered(p, c.size, 'Change the pipe size here or pick another joint layout.');
    for (const s of c.shims) add(CATALOG_FOR_KIND[s.kind].id, undefined, 1);
  }
  for (const f of analysis.fittings) {
    const p = CATALOG_FOR_KIND[f.kind];
    add(p.id, f.size, 1);
    offered(p, f.size, 'Choose a different end fitting for those pipe ends.');
  }
  for (const size of PIPE_SIZES) {
    const n = plan.sticksBySize[size];
    if (n) counts.set(priceKey('emt', size), { productId: 'emt', size, needed: n, source: 'pipe' });
  }
  return { needs: [...counts.values()], issues, bolts };
}

function toLine(n: Need, opts: OrderOptions, finish: Finish): BomLine {
  const p = CATALOG_BY_ID[n.productId];
  const qty = Math.ceil(n.needed / p.pack);
  const { price, basis, estimate } = priceFor(p.id, n.size, opts.priceOverrides);
  const variantId = variantFor(p, n.size, finish);
  return {
    key: `${n.source}:${priceKey(p.id, n.size)}`,
    productId: p.id,
    name: p.name,
    size: n.size,
    vendor: p.vendor,
    group: p.group,
    source: n.source,
    needed: n.needed,
    qty,
    pack: p.pack,
    unitPrice: price,
    total: price === null ? null : round2(price * qty),
    basis,
    estimate,
    note: n.note,
    url: p.url,
    variantId,
    soldOut: !!variantId && !!p.soldOut?.includes(variantId),
  };
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Connector counts (3/4 in only) that a bundle could cover. */
function coverable(needs: Need[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const n of needs) {
    const p = CATALOG_BY_ID[n.productId];
    if (!CONNECTOR_GROUPS.has(p.group) || n.size !== '3/4') continue;
    m.set(p.id, (m.get(p.id) ?? 0) + n.needed);
  }
  return m;
}

/** Cheapest way to buy the design's 3/4 in connectors using one bundle type, if it beats buying singles. */
export function suggestBundle(needs: Need[], overrides: Record<string, number>): BundleSuggestion | null {
  const want = coverable(needs);
  if (![...want.values()].some((v) => v > 0)) return null;
  const unit = (id: string) => priceFor(id, '3/4', overrides).price ?? 0;
  let baseline = 0;
  for (const [id, n] of want) baseline += n * unit(id);
  let best: BundleSuggestion | null = null;
  for (const b of Object.values(CATALOG_BY_ID)) {
    if (b.group !== 'bundle' || !b.bundle) continue;
    const price = priceFor(b.id, undefined, overrides).price;
    if (price === null) continue;
    for (let k = 1; k <= 3; k++) {
      let cost = price * k;
      let spare = 0;
      let useful = 0;
      const covered = new Map<string, number>();
      for (const item of b.bundle) covered.set(item.productId, (covered.get(item.productId) ?? 0) + item.qty * k);
      for (const [id, n] of want) {
        const have = covered.get(id) ?? 0;
        cost += Math.max(0, n - have) * unit(id);
        useful += Math.min(n, have);
      }
      for (const [id, have] of covered) {
        const p = CATALOG_BY_ID[id];
        if (CONNECTOR_GROUPS.has(p.group)) spare += Math.max(0, have - (want.get(id) ?? 0));
      }
      if (useful === 0) continue;
      const savings = round2(baseline - cost);
      if (savings > 0.99 && (!best || savings > best.savings || (savings === best.savings && spare < best.spare))) {
        best = { productId: b.id, name: b.name, qty: k, cost: round2(cost), savings, spare };
      }
    }
  }
  return best;
}

export function buildBom(design: Design, analysis: Analysis, plan: CutPlan, opts: OrderOptions): Bom {
  const finish = design.finish ?? 'silver';
  const { needs, issues, bolts } = designNeeds(analysis, plan);
  const lines: BomLine[] = [];

  // Bundle replaces single 3/4 in connectors it covers.
  const bundleProduct = opts.bundle ? CATALOG_BY_ID[opts.bundle.productId] : undefined;
  const covered = new Map<string, number>();
  const bundleTools = new Set<string>();
  if (bundleProduct?.bundle && opts.bundle) {
    for (const item of bundleProduct.bundle) {
      const p = CATALOG_BY_ID[item.productId];
      if (p.group === 'tool') bundleTools.add(p.id);
      else covered.set(item.productId, (covered.get(item.productId) ?? 0) + item.qty * opts.bundle.qty);
    }
    lines.push(
      toLine({ productId: bundleProduct.id, needed: opts.bundle.qty, source: 'bundle', size: undefined }, opts, finish),
    );
  }

  for (const n of needs) {
    let needed = n.needed;
    const p = CATALOG_BY_ID[n.productId];
    if (n.size === '3/4' && covered.has(p.id)) {
      const take = Math.min(needed, covered.get(p.id)!);
      covered.set(p.id, covered.get(p.id)! - take);
      needed -= take;
    }
    if (needed > 0) lines.push(toLine({ ...n, needed }, opts, finish));
    if (opts.spares && p.group === 'connector') lines.push(toLine({ ...n, needed: 1, source: 'spare' }, opts, finish));
  }

  const toolId = opts.tool === 'none' ? null : opts.tool === 'allen' ? 'allen' : opts.tool === 'short' ? 't-handle-short' : 't-handle-long';
  if (toolId && !bundleTools.has(toolId) && !(toolId === 'allen' && bundleTools.size)) {
    lines.push(toLine({ productId: toolId, needed: 1, source: 'tool' }, opts, finish));
  }
  if (opts.cutter) lines.push(toLine({ productId: 'cutter', needed: 1, source: 'tool' }, opts, finish));

  for (const [key, qty] of Object.entries(design.extras ?? {})) {
    if (qty <= 0) continue;
    const [productId, sizeRaw] = key.split('|');
    const p = CATALOG_BY_ID[productId];
    if (!p) continue;
    const size = (sizeRaw || undefined) as PipeSize | undefined;
    lines.push(toLine({ productId, size, needed: qty * p.pack, source: 'extra' }, opts, finish));
  }

  const priced = lines.filter((l) => l.total !== null);
  const makerpipeSubtotal = round2(priced.filter((l) => l.vendor === 'makerpipe').reduce((s, l) => s + l.total!, 0));
  const localSubtotal = round2(priced.filter((l) => l.vendor === 'local').reduce((s, l) => s + l.total!, 0));
  const hasStoreItems = lines.some((l) => l.vendor === 'makerpipe');
  const shipping = opts.shipping && hasStoreItems ? SHIPPING_FLAT : 0;
  const pipeWeightLb = PIPE_SIZES.reduce((s, size) => s + ((plan.totalLengthBySize[size] ?? 0) / 12) * EMT[size].lbPerFt, 0);

  return {
    lines,
    makerpipeSubtotal,
    localSubtotal,
    shipping,
    total: round2(makerpipeSubtotal + localSubtotal + shipping),
    unpriced: lines.filter((l) => l.total === null),
    bolts,
    connectorCount: analysis.connectors.length,
    pipeWeightLb,
    issues,
    suggestion: opts.bundle ? null : suggestBundle(needs, opts.priceOverrides),
  };
}

/**
 * Shopify cart permalink for every Maker Pipe line that has a known variant id
 * and is in stock. Lines without an id are `missing`; sold-out lines are left
 * out so they cannot break the cart.
 */
export function cartLink(bom: Bom): { url: string | null; missing: BomLine[]; soldOut: BomLine[] } {
  const store = bom.lines.filter((l) => l.vendor === 'makerpipe');
  const qty = new Map<string, number>();
  const missing: BomLine[] = [];
  const soldOut: BomLine[] = [];
  for (const l of store) {
    if (!l.variantId) missing.push(l);
    else if (l.soldOut) soldOut.push(l);
    else qty.set(l.variantId, (qty.get(l.variantId) ?? 0) + l.qty);
  }
  if (!qty.size) return { url: null, missing, soldOut };
  return { url: `${STORE}/cart/${[...qty].map(([id, n]) => `${id}:${n}`).join(',')}`, missing, soldOut };
}

const sizeLabel = (s?: PipeSize) => (s ? `${s}"` : '');

export function orderText(designName: string, bom: Bom): string {
  const row = (l: BomLine) =>
    `${String(l.qty).padStart(4)}  ${`${l.name}${l.pack > 1 ? ` (${l.pack}-pack)` : ''}`.padEnd(40)} ${sizeLabel(l.size).padEnd(5)} ${
      l.unitPrice === null ? 'price n/a'.padStart(10) : formatMoney(l.unitPrice).padStart(10)
    } ${l.total === null ? '' : formatMoney(l.total).padStart(10)}`;
  const store = bom.lines.filter((l) => l.vendor === 'makerpipe');
  const local = bom.lines.filter((l) => l.vendor === 'local');
  const out = [`${designName}: parts list`, '', 'From makerpipe.com', ...store.map(row)];
  out.push(`${''.padStart(62)}Subtotal ${formatMoney(bom.makerpipeSubtotal)}`);
  if (bom.shipping) out.push(`${''.padStart(62)}Shipping ${formatMoney(bom.shipping)} (estimate)`);
  if (local.length) {
    out.push('', 'From the hardware store', ...local.map(row));
    out.push(`${''.padStart(62)}Subtotal ${formatMoney(bom.localSubtotal)}`);
  }
  out.push('', `Estimated total ${formatMoney(bom.total)}`);
  if (bom.unpriced.length) out.push(`Not included (no listed price): ${bom.unpriced.map((l) => l.name).join(', ')}`);
  return out.join('\n');
}

export function orderCsv(bom: Bom): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['Vendor', 'Item', 'Size', 'Pack', 'Qty', 'Unit price', 'Line total', 'Price basis', 'URL'];
  const rows = bom.lines.map((l) =>
    [l.vendor === 'makerpipe' ? 'Maker Pipe' : 'Hardware store', l.name, sizeLabel(l.size), l.pack, l.qty, l.unitPrice?.toFixed(2), l.total?.toFixed(2), l.basis, l.url]
      .map(esc)
      .join(','),
  );
  return [head.join(','), ...rows].join('\n');
}

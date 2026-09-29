import { useEffect, useState } from 'react';
import {
  CATALOG,
  COLLECTION_URL,
  LIVE_FETCHED,
  type Product,
  type ProductGroup,
  basePrice,
  isEstimate,
  isSoldOut,
  priceKey,
  pricesGatheredLabel,
} from '../../catalog/catalog';
import type { PipeSize } from '../../model/types';
import { formatMoney } from '../../model/units';
import { useDerived } from '../../state/derived';
import { useStore } from '../../state/store';
import { Glyph } from '../Glyph';
import { Icon } from '../icons';

const GROUPS: { id: ProductGroup; title: string; note?: string }[] = [
  { id: 'connector', title: 'Connectors', note: 'Placed for you wherever pipes meet.' },
  { id: 'end', title: 'Flanges, caps, feet and casters', note: 'Pick these per pipe end on the Design tab.' },
  { id: 'accessory', title: 'Adapters and accessories' },
  { id: 'tool', title: 'Tools' },
  { id: 'bundle', title: 'Bundles', note: 'The Parts tab suggests a bundle when one saves money.' },
  { id: 'kit', title: 'Project kits' },
  { id: 'pipe', title: 'From the hardware store' },
];

const BASIS_TEXT: Record<string, string> = {
  verified: 'Matches the store’s bundle arithmetic',
  snapshot: 'From a store snapshot',
  live: 'Live store price',
  unknown: 'Price not found',
};

const sentence = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`);

function footNote(p: Product): string {
  return [BASIS_TEXT[p.basis], p.priceNote, p.sku ? `SKU ${p.sku}` : undefined]
    .filter((x): x is string => !!x)
    .map(sentence)
    .join(' ');
}

function PriceInput({ product, size }: { product: Product; size?: PipeSize }) {
  const overrides = useStore((s) => s.order.priceOverrides);
  const setPriceOverride = useStore((s) => s.setPriceOverride);
  const key = priceKey(product.id, size);
  const base = basePrice(product, size);
  const edited = key in overrides;
  const value = edited ? overrides[key] : base;
  const [text, setText] = useState(value === null ? '' : value.toFixed(2));
  useEffect(() => setText(value === null ? '' : value.toFixed(2)), [value]);
  const apply = () => {
    const t = text.trim().replace(/^\$/, '');
    if (t === '') return setPriceOverride(key, null);
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) {
      setText(value === null ? '' : value.toFixed(2));
      return;
    }
    if (base !== null && Math.abs(n - base) < 0.005) setPriceOverride(key, null);
    else setPriceOverride(key, n);
  };
  const id = `price-${product.id}-${size ?? 'any'}`.replace(/[^a-z0-9-]/gi, '_');
  return (
    <div className="price-cell">
      <label htmlFor={id}>
        {size ? `${size}"` : 'Price'}
        {product.pack > 1 ? ` · ${product.pack}-pack` : ''}
        {!edited && isEstimate(product, size) ? ' · est.' : ''}
        {isSoldOut(product, size) ? ' · sold out' : ''}
      </label>
      <span className={`price-input${edited ? ' edited' : ''}`}>
        $
        <input
          id={id}
          inputMode="decimal"
          value={text}
          placeholder="—"
          onChange={(e) => setText(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </span>
    </div>
  );
}

function ExtraStepper({ product, size }: { product: Product; size?: PipeSize }) {
  const extras = useStore((s) => s.design.extras);
  const setExtra = useStore((s) => s.setExtra);
  const key = priceKey(product.id, size);
  const qty = extras?.[key] ?? 0;
  return (
    <span className="stepper" aria-label={`Extra ${product.name}${size ? ` ${size}"` : ''} to order`}>
      <button onClick={() => setExtra(key, qty - 1)} aria-label="Remove one" disabled={qty === 0}>
        −
      </button>
      <span>{qty}</span>
      <button onClick={() => setExtra(key, qty + 1)} aria-label="Add one">
        +
      </button>
    </span>
  );
}

function ProductCard({ p, used }: { p: Product; used: number }) {
  const sizes = p.sizes && p.group !== 'bundle' ? p.sizes : undefined;
  const [extraSize, setExtraSize] = useState<PipeSize | undefined>(sizes?.includes('3/4') ? '3/4' : sizes?.[0]);
  return (
    <div className="product">
      <Glyph id={p.id} />
      <div style={{ minWidth: 0 }}>
        <div className="row spread">
          <div className="product-name">{p.name}</div>
          {used > 0 && <span className="chip accent">{used} in this design</span>}
        </div>
        <div className="product-blurb">{p.blurb}</div>
        {p.bundle && (
          <div className="product-blurb">
            Contents:{' '}
            {p.bundle
              .map((b) => {
                const item = CATALOG.find((x) => x.id === b.productId);
                return `${b.qty} ${item?.name ?? b.productId}`;
              })
              .join(', ')}
            .
          </div>
        )}
        <div className="price-grid">
          {sizes ? sizes.map((s) => <PriceInput key={s} product={p} size={s} />) : <PriceInput product={p} />}
          {p.compareAt && (
            <div className="price-cell">
              <label>Regular</label>
              <span className="mono small muted" style={{ lineHeight: '28px', textDecoration: 'line-through' }}>
                {formatMoney(p.compareAt)}
              </span>
            </div>
          )}
        </div>
        <div className="product-foot">
          <span className="muted">{footNote(p)}</span>
        </div>
        <div className="product-foot">
          <span className="row">
            {p.url && (
              <a href={p.url} target="_blank" rel="noreferrer" className="btn small">
                {p.vendor === 'local' ? 'Example listing' : 'Store page'} <Icon.external />
              </a>
            )}
            {p.video && (
              <a href={p.video} target="_blank" rel="noreferrer" className="btn small ghost">
                Assembly video <Icon.external />
              </a>
            )}
          </span>
          {p.vendor === 'makerpipe' && (
            <span className="row">
              {sizes && sizes.length > 1 && (
                <select aria-label="Size to add" value={extraSize} onChange={(e) => setExtraSize(e.target.value as PipeSize)} style={{ height: 28 }}>
                  {sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}"
                    </option>
                  ))}
                </select>
              )}
              <ExtraStepper product={p} size={sizes ? extraSize : undefined} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CatalogTab() {
  const { bom } = useDerived();
  const order = useStore((s) => s.order);
  const setOrder = useStore((s) => s.setOrder);
  const edits = Object.keys(order.priceOverrides).length;
  const usedBy = new Map<string, number>();
  for (const l of bom.lines) if (l.source === 'design' || l.source === 'pipe') usedBy.set(l.productId, (usedBy.get(l.productId) ?? 0) + l.needed);

  return (
    <div className="panel-body">
      <div className="section">
        <div className="section-head">
          <h2>Prices</h2>
          {edits > 0 && (
            <button className="btn small" onClick={() => setOrder({ priceOverrides: {} })}>
              Reset {edits} edited {edits === 1 ? 'price' : 'prices'}
            </button>
          )}
        </div>
        <p className="note">
          Every item in Maker Pipe’s{' '}
          <a href={COLLECTION_URL} target="_blank" rel="noreferrer">
            Modular Pipe Fittings & Accessories
          </a>{' '}
          collection, with prices {LIVE_FETCHED ? 'fetched from the store' : 'gathered'} on {pricesGatheredLabel()}. Click any price to
          correct it; totals use your figures.{' '}
          {LIVE_FETCHED
            ? 'Where a product has options, the price is for the store’s first-listed option (the complete part, not spare pieces).'
            : 'Where the store showed one price for several sizes, the 1/2" and 1" prices are marked “est.”.'}{' '}
          Use the + buttons to add extras to your order.
        </p>
      </div>
      {GROUPS.map((g) => {
        const items = CATALOG.filter((p) => p.group === g.id);
        if (!items.length) return null;
        return (
          <div className="catalog-group" key={g.id}>
            <div className="section-head">
              <h3>{g.title}</h3>
              <span className="small muted">{items.length}</span>
            </div>
            {g.note && <p className="note">{g.note}</p>}
            {items.map((p) => (
              <ProductCard key={p.id} p={p} used={usedBy.get(p.id) ?? 0} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

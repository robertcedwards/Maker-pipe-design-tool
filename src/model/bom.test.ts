import { describe, expect, it } from 'vitest';
import { analyze } from './analyze';
import { DEFAULT_ORDER, buildBom, cartLink, orderCsv, orderText, suggestBundle, designNeeds } from './bom';
import { buildCutPlan } from './cutlist';
import { TEMPLATES, designFromTemplate, templateDefaults } from './templates';
import type { Design, Pipe } from './types';
import { PRODUCTS, applyLivePrices, sizeFromTitle, colorFromTitle } from '../catalog/catalog';

const tpl = (id: string, over: Record<string, number> = {}) => {
  const t = TEMPLATES.find((x) => x.id === id)!;
  return designFromTemplate(t, { ...templateDefaults(t), ...over }, '3/4');
};
const bomOf = (d: Design, opts = DEFAULT_ORDER) => {
  const a = analyze(d);
  const plan = buildCutPlan(a);
  return buildBom(d, a, plan, opts);
};
const line = (bom: ReturnType<typeof bomOf>, productId: string) => bom.lines.find((l) => l.productId === productId);

describe('bill of materials', () => {
  it('shelf unit: connectors, caps by the pack, pipe by the stick, a T handle', () => {
    const bom = bomOf(tpl('shelf'));
    expect(line(bom, '90')).toMatchObject({ qty: 12, unitPrice: 5.95, total: 71.4, size: '3/4' });
    expect(line(bom, 't')).toMatchObject({ qty: 6, total: 22.44 });
    expect(line(bom, 'cap')).toMatchObject({ needed: 4, qty: 1, pack: 10, total: 4.95 });
    expect(line(bom, 'emt')!.vendor).toBe('local');
    expect(line(bom, 't-handle-short')).toBeDefined();
    expect(bom.bolts).toBe(12 * 2 + 6 * 1);
    expect(bom.total).toBeCloseTo(bom.makerpipeSubtotal + bom.localSubtotal + bom.shipping, 6);
  });

  it('user price edits flow into the totals', () => {
    const base = bomOf(tpl('shelf'));
    const edited = bomOf(tpl('shelf'), { ...DEFAULT_ORDER, priceOverrides: { '90|3/4': 5 } });
    expect(line(edited, '90')!.basis).toBe('edited');
    expect(edited.makerpipeSubtotal).toBeCloseTo(base.makerpipeSubtotal - 12 * 0.95, 6);
  });

  it('flags sizes a product is not sold in', () => {
    const d = 10 / Math.SQRT2;
    const pipes: Pipe[] = [
      { id: 'run', a: [0, 0, 0], b: [0, 30, 0], size: '1' },
      { id: 'a', a: [0, 15, 0], b: [10, 15, 0], size: '1' },
      { id: 'b', a: [0, 15, 0], b: [-d, 15, d], size: '1' },
    ];
    const bom = bomOf({ version: 1, name: 'oct', pipes, joints: {}, defaultEnd: 'open' });
    expect(bom.issues.some((i) => i.message.includes('135 Degree Connector'))).toBe(true);
  });

  it('unknown prices are listed but kept out of totals', () => {
    const d = tpl('rack');
    d.defaultEnd = 'caster';
    const bom = bomOf(d);
    expect(bom.unpriced.map((l) => l.productId)).toContain('caster-kit');
    expect(line(bom, 'caster-kit')).toMatchObject({ qty: 1, total: null });
  });

  it('hand-added extras are included', () => {
    const d = tpl('rack');
    d.extras = { 'quick-clamp|': 3, 'inserts|3/4': 1 };
    const bom = bomOf(d);
    expect(line(bom, 'quick-clamp')).toMatchObject({ qty: 3, total: 8.85, source: 'extra' });
    expect(line(bom, 'inserts')).toMatchObject({ qty: 1, size: '3/4' });
  });

  it('suggests a bundle only when it saves money, and applies it', () => {
    // 50 T connectors: the Maker Bundle (48 T) plus 2 singles beats 50 singles.
    const pipes: Pipe[] = [{ id: 'run', a: [0, 0, 0], b: [0, 0, 110], size: '3/4' }];
    for (let i = 0; i < 25; i++) {
      const z = 4 + i * 4;
      pipes.push({ id: `l${i}`, a: [0, 0, z], b: [-10, 0, z], size: '3/4' }, { id: `r${i}`, a: [0, 0, z], b: [0, 10, z], size: '3/4' });
    }
    const design: Design = { version: 1, name: 'grid', pipes, joints: {}, defaultEnd: 'open' };
    const a = analyze(design);
    const plan = buildCutPlan(a);
    // Two perpendicular arms at each point make 90 Degree corners; recount as Ts by splitting them.
    const { needs } = designNeeds(a, plan);
    expect(needs.find((n) => n.productId === '90')!.needed).toBe(25);
    const s = suggestBundle(needs, {});
    // 25 x $5.95 = $148.75; the Starter Bundle ($148.15) covers only 8 corners, so no bundle wins here.
    expect(s).toBeNull();

    const tees: Pipe[] = [{ id: 'run', a: [0, 0, 0], b: [0, 0, 250], size: '3/4' }];
    for (let i = 0; i < 50; i++) tees.push({ id: `t${i}`, a: [0, 0, 3 + i * 4.9], b: [0, 10, 3 + i * 4.9], size: '3/4' });
    const d2: Design = { version: 1, name: 'tees', pipes: tees, joints: {}, defaultEnd: 'open' };
    const a2 = analyze(d2);
    const n2 = designNeeds(a2, buildCutPlan(a2)).needs;
    const s2 = suggestBundle(n2, {})!;
    expect(s2.productId).toBe('b-maker');
    expect(s2.savings).toBeCloseTo(50 * 3.74 - (161.56 + 2 * 3.74), 2);

    const applied = buildBom(d2, a2, buildCutPlan(a2), { ...DEFAULT_ORDER, bundle: { productId: 'b-maker', qty: 1 } });
    expect(applied.lines.find((l) => l.productId === 'b-maker')!.qty).toBe(1);
    expect(applied.lines.find((l) => l.productId === 't' && l.source === 'design')!.qty).toBe(2);
    expect(applied.suggestion).toBeNull();
  });

  it('exports text and CSV', () => {
    const bom = bomOf(tpl('cube'));
    expect(orderText('Cube', bom)).toContain('90 Degree Connector');
    const csv = orderCsv(bom).split('\n');
    expect(csv[0]).toBe('Vendor,Item,Size,Pack,Qty,Unit price,Line total,Price basis,URL');
    expect(csv.length).toBe(bom.lines.length + 1);
  });

  it('has no cart link until variant ids are known', () => {
    const { url, missing } = cartLink(bomOf(tpl('cube')));
    expect(url).toBeNull();
    expect(missing.length).toBeGreaterThan(0);
  });
});

describe('live price overlay', () => {
  it('reads sizes and colours from Shopify variant titles', () => {
    expect(sizeFromTitle('3/4" / Silver')).toBe('3/4');
    expect(sizeFromTitle('1/2" (with shims)')).toBe('1/2');
    expect(sizeFromTitle('1" / Black')).toBe('1');
    expect(sizeFromTitle('1 inch')).toBe('1');
    expect(sizeFromTitle('Default Title')).toBeUndefined();
    expect(colorFromTitle('3/4" / Black')).toBe('black');
  });

  it('replaces prices and adds variant ids', () => {
    const live = {
      fetchedAt: '2026-10-01T12:00:00Z',
      products: {
        't-connector': {
          variants: [
            { id: '111', title: '3/4" / Silver', price: 3.5 },
            { id: '112', title: '3/4" / Black', price: 3.5 },
            { id: '113', title: '1" / Silver', price: 4.25 },
          ],
        },
      },
    };
    const next = applyLivePrices(PRODUCTS, live);
    const t = next.find((p) => p.id === 't')!;
    expect(t.basis).toBe('live');
    expect(t.price).toEqual({ '3/4': 3.5, '1': 4.25 });
    expect(t.variants?.['3/4']).toEqual({ silver: '111', black: '112' });
    expect(next.find((p) => p.id === '90')!.basis).toBe('verified');
  });
});

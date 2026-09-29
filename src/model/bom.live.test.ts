import { describe, expect, it, vi } from 'vitest';
import { analyze } from './analyze';
import { DEFAULT_ORDER, buildBom, cartLink } from './bom';
import { buildCutPlan } from './cutlist';
import { TEMPLATES, designFromTemplate, templateDefaults } from './templates';
import type { Design, EndFitting, PipeSize } from './types';

// A cut-down copy of what `npm run sync-prices` wrote on 2026-09-29, so these
// tests do not change when the real file is refreshed.
vi.mock('../catalog/live-prices.json', () => ({
  default: {
    fetchedAt: '2026-09-29T15:34:44.275Z',
    products: {
      '90-degree-connector': {
        variants: [
          { id: '901', title: 'SIlver / 3/4"', price: 5.95, available: true },
          { id: '902', title: 'SIlver / 1/2"', price: 6.25, available: true },
          { id: '903', title: 'SIlver / 1"', price: 8.79, available: true },
        ],
      },
      't-connector': {
        variants: [
          { id: 't34', title: 'Silver / 3/4"', price: 3.74, available: true },
          { id: 't12', title: 'Silver / 1/2"', price: 3.94, available: true },
          { id: 't1', title: 'Silver / 1"', price: 4.95, available: true },
        ],
      },
      'flange-connector': {
        variants: [
          { id: 'f34', title: 'Silver / 3/4"', price: 5.45, available: true },
          { id: 'f12', title: 'Silver / 1/2"', price: 5.55, available: true },
          { id: 'f1', title: 'Silver / 1"', price: 5.95, available: true },
        ],
      },
      'caster-kit-structural-pipe-project': {
        variants: [
          { id: 'c34', title: '3/4" EMT Conduit', price: 43.95, available: true },
          { id: 'c1', title: '1" EMT Conduit', price: 43.95, available: false },
        ],
      },
      't-handle-hex-wrench-short': { variants: [{ id: 'th', title: '', price: 7.95, available: true }] },
    },
  },
}));

const tpl = (id: string, size: PipeSize, ends: EndFitting): Design => {
  const t = TEMPLATES.find((x) => x.id === id)!;
  return { ...designFromTemplate(t, templateDefaults(t), size), defaultEnd: ends };
};
const bomOf = (d: Design) => {
  const a = analyze(d);
  return buildBom(d, a, buildCutPlan(a), DEFAULT_ORDER);
};

describe('bill of materials with live store data', () => {
  it('prices from the store and fills the cart link', () => {
    const bom = bomOf(tpl('cube', '1', 'cap'));
    const corners = bom.lines.find((l) => l.productId === '90')!;
    expect(corners).toMatchObject({ size: '1', unitPrice: 8.79, basis: 'live', variantId: '903' });
    const { url } = cartLink(bom);
    expect(url).toContain(`903:${corners.qty}`);
    expect(url).toContain('th:1');
  });

  it('uses the sizes the store sells', () => {
    // The researched catalog listed the flange in 1/2 in and 3/4 in only.
    const bom = bomOf(tpl('shelf', '1', 'flange'));
    expect(bom.lines.find((l) => l.productId === 'flange')).toMatchObject({ size: '1', unitPrice: 5.95 });
    expect(bom.issues.filter((i) => i.message.includes('not sold'))).toEqual([]);
  });

  it('keeps sold-out items out of the cart', () => {
    const bom = bomOf(tpl('rack', '1', 'caster'));
    const casters = bom.lines.find((l) => l.productId === 'caster-kit')!;
    expect(casters.soldOut).toBe(true);
    const { url, soldOut } = cartLink(bom);
    expect(soldOut).toContain(casters);
    expect(url).not.toContain('c1:');
  });
});

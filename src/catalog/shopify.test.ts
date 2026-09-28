import { describe, expect, it } from 'vitest';
import { PRODUCTS } from './catalog';
import { handlesInCatalogSource, parseShopifyProduct } from './shopify';
import catalogSource from './catalog.ts?raw';

describe('Shopify product parsing', () => {
  it('reads the .js format (prices in cents)', () => {
    const p = parseShopifyProduct(
      {
        title: 'T Connector',
        variants: [
          { id: 39295993151561, title: '3/4" / Silver', option1: '3/4"', option2: 'Silver', price: 374, compare_at_price: null, available: true, sku: 'MP0001' },
          { id: 2, title: '1" / Black', price: 425, compare_at_price: 450, available: false },
        ],
      },
      'js',
    )!;
    expect(p.variants).toEqual([
      { id: '39295993151561', title: '3/4" / Silver', price: 3.74, compareAt: null, available: true, sku: 'MP0001' },
      { id: '2', title: '1" / Black', price: 4.25, compareAt: 4.5, available: false, sku: null },
    ]);
  });

  it('reads the .json format (prices as strings)', () => {
    const p = parseShopifyProduct({ product: { title: 'Cap', variants: [{ id: 7, title: 'Default Title', option1: 'Default Title', price: '4.95' }] } }, 'json')!;
    expect(p.variants[0]).toMatchObject({ id: '7', title: '', price: 4.95 });
  });

  it('rejects junk', () => {
    expect(parseShopifyProduct(null, 'js')).toBeNull();
    expect(parseShopifyProduct({ variants: 'x' }, 'js')).toBeNull();
    expect(parseShopifyProduct({ variants: [{ title: 'no id', price: 1 }] }, 'js')!.variants).toEqual([]);
  });

  it('finds every catalog handle in the catalog source', () => {
    const handles = handlesInCatalogSource(catalogSource);
    const expected = PRODUCTS.filter((p) => p.vendor === 'makerpipe').map((p) => p.handle).sort();
    expect(handles).toEqual(expected);
  });
});

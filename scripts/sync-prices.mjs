#!/usr/bin/env node
// Refresh src/catalog/live-prices.json with current prices and Shopify variant
// ids from makerpipe.com. The app overlays this file on its researched catalog,
// which also switches on the "add everything to the cart" link.
//
//   npm run sync-prices                 # fetch every product in the catalog
//   MAKERPIPE_STORE=http://localhost:8787 npm run sync-prices   # e.g. a mirror
//
// Uses the public storefront endpoint /products/<handle>.js. Products the
// store no longer has are reported and skipped. Needs Node 22.18+ (or
// --experimental-strip-types) because it imports the TypeScript parser.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { handlesInCatalogSource, parseShopifyProduct } from '../src/catalog/shopify.ts';

const STORE = (process.env.MAKERPIPE_STORE ?? 'https://makerpipe.com').replace(/\/$/, '');
const catalogPath = fileURLToPath(new URL('../src/catalog/catalog.ts', import.meta.url));
const outPath = fileURLToPath(new URL('../src/catalog/live-prices.json', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const handles = handlesInCatalogSource(await readFile(catalogPath, 'utf8'));
console.log(`Fetching ${handles.length} products from ${STORE}`);

const products = {};
const missing = [];
for (const handle of handles) {
  const url = `${STORE}/products/${encodeURIComponent(handle)}.js`;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      missing.push(`${handle} (HTTP ${res.status})`);
      continue;
    }
    const parsed = parseShopifyProduct(await res.json(), 'js');
    if (!parsed || !parsed.variants.length) {
      missing.push(`${handle} (no variants)`);
      continue;
    }
    products[handle] = parsed;
    const prices = parsed.variants.map((v) => `${v.title || 'default'} $${v.price.toFixed(2)}`).join(', ');
    console.log(`  ${handle}: ${prices}`);
  } catch (err) {
    missing.push(`${handle} (${err instanceof Error ? err.message : String(err)})`);
  }
  await sleep(Number(process.env.SYNC_DELAY_MS ?? 250));
}

if (!Object.keys(products).length) {
  console.error('\nNo products could be fetched; live-prices.json was left unchanged.');
  if (missing.length) console.error(`Failures:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

await writeFile(outPath, `${JSON.stringify({ fetchedAt: new Date().toISOString(), source: STORE, products }, null, 2)}\n`);
console.log(`\nWrote ${Object.keys(products).length} products to src/catalog/live-prices.json`);
if (missing.length) console.log(`Skipped:\n  ${missing.join('\n  ')}`);

// New products in the collection that the catalog does not know about yet.
try {
  const res = await fetch(`${STORE}/collections/modular-pipe-fittings/products.json?limit=250`);
  if (res.ok) {
    const body = await res.json();
    const known = new Set(handles);
    const fresh = (body.products ?? []).map((p) => p.handle).filter((h) => h && !known.has(h));
    if (fresh.length) console.log(`\nIn the collection but not in src/catalog/catalog.ts:\n  ${fresh.join('\n  ')}`);
  }
} catch {
  /* the collection check is optional */
}

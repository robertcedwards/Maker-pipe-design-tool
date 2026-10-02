// Maker Pipe catalog: every connector, flange, accessory, tool and bundle in
// the store's Modular Pipe Fittings & Accessories collection, plus EMT conduit
// from the hardware store.
//
// Where the numbers come from: makerpipe.com could not be fetched directly
// while this was written, so prices were gathered on 2026-09-27 from
// search-engine snapshots of the store and cross-checked against Maker Pipe's
// bundle "compare at" prices (which are the sums of the single-item prices).
// Every price carries a `basis` so the UI can say how sure it is, the Price
// list tab lets people correct any price, and `npm run sync-prices` replaces
// them with live store data (see scripts/sync-prices.mjs and live-prices.json).

import type { ConnectorKind, PipeSize } from '../model/types';
import type { FittingKind, ShimKind } from '../model/analyze';
import live from './live-prices.json';

export const STORE = 'https://makerpipe.com';
export const COLLECTION_URL = `${STORE}/collections/modular-pipe-fittings`;
export const PRICES_GATHERED = '2026-09-27';

/** Date of the live price sync, if one has been committed. */
export const LIVE_FETCHED: string | null = (live as LivePrices).fetchedAt?.slice(0, 10) ?? null;

export const pricesGatheredLabel = (): string =>
  new Date(`${LIVE_FETCHED ?? PRICES_GATHERED}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * - verified: matches the store's own bundle price arithmetic
 * - snapshot: seen on a search snapshot of the product page, date unknown
 * - estimate: assumed equal to the 3/4 in price (the 1/2 in variant is the 3/4 in part plus shims)
 * - live:     fetched from the store by `npm run sync-prices`
 * - unknown:  no price found; the item is left out of totals
 */
export type PriceBasis = 'verified' | 'snapshot' | 'estimate' | 'live' | 'unknown';

export type ProductGroup = 'connector' | 'end' | 'accessory' | 'tool' | 'bundle' | 'kit' | 'pipe';

export interface BundleItem {
  productId: string;
  qty: number;
}

export interface Product {
  id: string;
  /** makerpipe.com product handle (URL slug). */
  handle: string;
  name: string;
  group: ProductGroup;
  blurb: string;
  /** Sizes sold. Undefined for items that are not sized. */
  sizes?: PipeSize[];
  /** Price per purchase unit (a pack for packed items). A single number applies to every size. */
  price: number | null | Partial<Record<PipeSize, number | null>>;
  /** Sizes whose price is assumed from another size rather than seen. */
  estimatedSizes?: PipeSize[];
  basis: PriceBasis;
  priceNote?: string;
  /** Pieces per purchase unit. */
  pack: number;
  /** Store "compare at" (regular) price, for bundles on sale. */
  compareAt?: number;
  /** Design element this product supplies. */
  kind?: ConnectorKind | FittingKind | ShimKind;
  /** M6 bolts in one connector. */
  bolts?: number;
  /** Adapter shims shipped with the 1/2 in variant. */
  shims12?: number;
  bundle?: BundleItem[];
  includes?: string[];
  sku?: string;
  video?: string;
  /** Sold by Maker Pipe or bought locally. */
  vendor: 'makerpipe' | 'local';
  /** Shopify variant ids by size, filled in by the live price sync. */
  variants?: Partial<Record<PipeSize | 'any', { silver?: string; black?: string; any?: string }>>;
  /** Variant ids the store lists as sold out (live price sync). */
  soldOut?: string[];
  url: string;
}

const P = (handle: string) => `${STORE}/products/${handle}`;

const CORE_SIZES: PipeSize[] = ['1/2', '3/4', '1'];

/**
 * Sized price where only one price was found. The store shows a single "from"
 * price, taken to be the 3/4 in variant; the other sizes are assumed to cost
 * the same and are flagged as estimates.
 */
function sized(price: number, sizes: PipeSize[] = CORE_SIZES) {
  return {
    sizes,
    price: Object.fromEntries(sizes.map((s) => [s, price])) as Partial<Record<PipeSize, number>>,
    estimatedSizes: sizes.filter((s) => s !== '3/4'),
  };
}

export const PRODUCTS: Product[] = [
  // ---- Connectors placed automatically at joints ----
  {
    id: 't',
    handle: 't-connector',
    name: 'T Connector',
    group: 'connector',
    kind: 't',
    blurb: 'Clamps the side of one pipe and the end of another at 90°. It swivels around the pipe and doubles as an elbow on a pipe end. The most-used connector.',
    ...sized(3.74),
    basis: 'verified',
    priceNote: 'Maker and Pro bundles price the T at $3.74. Hardware stores list it at $3.99.',
    pack: 1,
    bolts: 1,
    shims12: 2,
    video: 'https://www.youtube.com/watch?v=7WiouBh1PL0',
    vendor: 'makerpipe',
    url: P('t-connector'),
  },
  {
    id: '90',
    handle: '90-degree-connector',
    name: '90 Degree Connector',
    group: 'connector',
    kind: '90',
    blurb: 'Box corner: one pipe runs through, two pipe ends meet it at 90° to each other. For shelves, desks and anything cube-shaped.',
    ...sized(5.95),
    basis: 'verified',
    pack: 1,
    bolts: 2,
    shims12: 3,
    sku: 'MP0023',
    video: 'https://www.youtube.com/watch?v=THXoTQmmV18',
    vendor: 'makerpipe',
    url: P('90-degree-connector'),
  },
  {
    id: '180',
    handle: '180-degree-connector',
    name: '180 Degree Connector',
    group: 'connector',
    kind: '180',
    blurb: 'One pipe runs through the centre, two pipe ends meet it from opposite sides in a straight line.',
    ...sized(5.45),
    basis: 'verified',
    pack: 1,
    bolts: 2,
    shims12: 3,
    video: 'https://m.youtube.com/watch?v=bsm2AcLCgGk',
    vendor: 'makerpipe',
    url: P('180-degree-connector'),
  },
  {
    id: '45',
    handle: '45-degree-connector',
    name: '45 Degree Connector',
    group: 'connector',
    kind: '45',
    blurb: 'Holds a pipe end at 45° to a through pipe. For bracing and angled members.',
    ...sized(5.45),
    basis: 'verified',
    pack: 1,
    bolts: 1,
    shims12: 2,
    video: 'https://www.youtube.com/watch?v=33MA3u8BHtE',
    vendor: 'makerpipe',
    url: P('45-degree-connector'),
  },
  {
    id: '135',
    handle: '135-degree-structural-pipe-connector',
    name: '135 Degree Connector',
    group: 'connector',
    kind: '135',
    blurb: 'One pipe runs through, two pipe ends meet it 135° apart. For octagons and roof lines.',
    ...sized(5.79, ['1/2', '3/4']),
    basis: 'snapshot',
    pack: 1,
    bolts: 2,
    shims12: 3,
    video: 'https://www.youtube.com/watch?v=H2yyCiMQqAk',
    vendor: 'makerpipe',
    url: P('135-degree-structural-pipe-connector'),
  },
  {
    id: '4way',
    handle: '4-way-connector-structural-pipe-project',
    name: '4 Way Connector',
    group: 'connector',
    kind: '4way',
    blurb: 'One pipe runs through, three pipe ends meet it at 90° steps.',
    ...sized(7.49),
    basis: 'snapshot',
    pack: 1,
    bolts: 3,
    shims12: 4,
    video: 'https://www.youtube.com/watch?v=bjJMlU2hGeM',
    vendor: 'makerpipe',
    url: P('4-way-connector-structural-pipe-project'),
  },
  {
    id: '5way',
    handle: '5-way-connector',
    name: '5 Way Connector',
    group: 'connector',
    kind: '5way',
    blurb: 'One pipe runs through, four pipe ends meet it in a plus sign.',
    ...sized(8.49),
    basis: 'snapshot',
    pack: 1,
    bolts: 4,
    shims12: 5,
    video: 'https://www.youtube.com/watch?v=-6HBz_kBRSQ',
    vendor: 'makerpipe',
    url: P('5-way-connector'),
  },
  {
    id: 'adjustable',
    handle: 'adjustable-angle-connector-hinge-connector',
    name: 'Adjustable Angle Hinge Connector',
    group: 'connector',
    kind: 'adjustable',
    blurb: 'Holds a pipe end at any angle up to 90° either way. Lock the pivot bolt to fix the angle, or leave it snug to make a hinge.',
    ...sized(7.49),
    basis: 'verified',
    priceNote: 'The store lists it "from $3.24", which appears to be one half. $7.49 for the complete connector matches the bundle arithmetic.',
    pack: 1,
    bolts: 2,
    sku: 'MP00011',
    video: 'https://www.youtube.com/watch?v=VnWF5-n8hNM',
    vendor: 'makerpipe',
    url: P('adjustable-angle-connector-hinge-connector'),
  },
  {
    id: 'adjustable-180',
    handle: 'adjustable-180-degree-connector',
    name: 'Adjustable 180 Degree Connector',
    group: 'connector',
    kind: 'adjustable-180',
    blurb: 'One pipe runs through; two pipe ends on opposite sides each tilt up to 90° either way. Even bracing without stacking connectors.',
    sizes: ['1/2', '3/4'],
    price: null,
    basis: 'unknown',
    priceNote: 'Listed "from $2.95", which looks like a single piece. The complete connector price was not found.',
    pack: 1,
    bolts: 4,
    vendor: 'makerpipe',
    url: P('adjustable-180-degree-connector'),
  },
  {
    id: 'coupling',
    handle: 'structural-emt-conduit-coupling',
    name: 'EMT Conduit Structural Coupling',
    group: 'connector',
    kind: 'coupling',
    blurb: 'Joins two pipe ends in a straight line, for runs longer than a 10 ft stick. Up to four self-tapping screws add pull-out strength.',
    ...sized(5.45),
    basis: 'snapshot',
    pack: 1,
    bolts: 1,
    shims12: 2,
    sku: 'MP0062',
    video: 'https://www.youtube.com/watch?v=W8OTuF7EyGM',
    vendor: 'makerpipe',
    url: P('structural-emt-conduit-coupling'),
  },
  {
    id: 'pro-t',
    handle: 'pro-t-connector',
    name: 'Pro T Connector',
    group: 'connector',
    blurb: '1 in EMT T with pre-drilled holes for #8 self-tapping screws and a pre-applied friction band.',
    sizes: ['1'],
    price: { '1': 4.95 },
    basis: 'snapshot',
    pack: 1,
    bolts: 1,
    vendor: 'makerpipe',
    url: P('pro-t-connector'),
  },
  {
    id: 'top-rail-t',
    handle: 'top-rail-t-connector',
    name: 'Top Rail T Connector',
    group: 'connector',
    blurb: 'T connector sized for 1-3/8 in chain-link fence top rail (1 in EMT with a shim).',
    price: 5.99,
    basis: 'snapshot',
    priceNote: 'One snapshot showed it out of stock.',
    pack: 1,
    bolts: 1,
    vendor: 'makerpipe',
    url: P('top-rail-t-connector'),
  },
  {
    id: 'barrel-hinge',
    handle: 'barrel-hinge',
    name: 'Barrel Hinge',
    group: 'connector',
    blurb: 'In-line hinge for 3/4 in EMT doors and lids. 4 in tall, 0.94 in across.',
    price: 6.49,
    basis: 'snapshot',
    pack: 1,
    vendor: 'makerpipe',
    url: P('barrel-hinge'),
  },

  // ---- End fittings ----
  {
    id: 'flange',
    handle: 'flange-connector',
    name: 'Flange Connector',
    group: 'end',
    kind: 'flange',
    blurb: 'Mounts a pipe end square to a wall, floor or tabletop. Two mirrored pieces clamp the pipe; screw the base down.',
    ...sized(5.45, ['1/2', '3/4']),
    basis: 'verified',
    pack: 1,
    shims12: 1,
    video: 'https://www.youtube.com/watch?v=uNABNWXaiuc',
    vendor: 'makerpipe',
    url: P('flange-connector'),
  },
  {
    id: 'angle-flange',
    handle: 'adjustable-angle-flange',
    name: 'Adjustable Angle Flange',
    group: 'end',
    kind: 'angle-flange',
    blurb: 'Mounts a pipe end to a flat surface at an adjustable angle.',
    sizes: ['3/4'],
    price: { '3/4': 7.49 },
    basis: 'snapshot',
    priceNote: 'Snapshots disagree: "from $3.24" (likely half a set) and $7.49.',
    pack: 1,
    video: 'https://www.youtube.com/watch?v=yaDdoVqueTU',
    vendor: 'makerpipe',
    url: P('adjustable-angle-flange'),
  },
  {
    id: 'cap',
    handle: 'conduit-end-cap-plug',
    name: 'Conduit End Cap',
    group: 'end',
    kind: 'cap',
    blurb: 'Black plug that taps flush into an open pipe end. Doubles as a floor-friendly foot. 10 per pack.',
    ...sized(4.95),
    basis: 'snapshot',
    pack: 10,
    sku: 'MP2003',
    vendor: 'makerpipe',
    url: P('conduit-end-cap-plug'),
  },
  {
    id: 'feet',
    handle: 'rubber-pipe-feet',
    name: 'Rubber Pipe Feet',
    group: 'end',
    kind: 'foot',
    blurb: 'Push-on rubber feet for pipe ends. No tools. 4 per pack.',
    ...sized(3.95),
    basis: 'snapshot',
    pack: 4,
    vendor: 'makerpipe',
    url: P('rubber-pipe-feet'),
  },
  {
    id: 'caster-kit',
    handle: 'caster-kit-structural-pipe-project',
    name: 'Caster Kit',
    group: 'end',
    kind: 'caster',
    blurb: 'Four locking swivel casters with inserts that tap into the pipe ends with a rubber mallet.',
    sizes: ['3/4', '1'],
    price: null,
    basis: 'unknown',
    pack: 4,
    video: 'https://www.youtube.com/watch?v=qzOYhKelu4E',
    vendor: 'makerpipe',
    url: P('caster-kit-structural-pipe-project'),
  },
  {
    id: 'caster-insert',
    handle: 'caster-insert-5x13x1-5',
    name: 'Caster Insert 1/2-13 x 1.5',
    group: 'end',
    blurb: 'Threaded insert for fitting your own 1/2-13 stem casters to pipe ends.',
    price: null,
    basis: 'unknown',
    pack: 4,
    vendor: 'makerpipe',
    url: P('caster-insert-5x13x1-5'),
  },

  // ---- Adapters ----
  {
    id: 'shim-3/4-1/2',
    handle: '1-2-emt-conduit-adapter-shim',
    name: '3/4" to 1/2" EMT Adapter Shim',
    group: 'accessory',
    kind: '3/4-1/2',
    blurb: 'Snaps onto 1/2 in EMT so a 3/4 in connector can clamp it. One per pipe per connection.',
    price: 0.1,
    basis: 'snapshot',
    pack: 1,
    vendor: 'makerpipe',
    url: P('1-2-emt-conduit-adapter-shim'),
  },
  {
    id: 'shim-1-3/4',
    handle: '1-to-3-4-emt-conduit-adapter-shim',
    name: '1" to 3/4" EMT Adapter Shim',
    group: 'accessory',
    kind: '1-3/4',
    blurb: 'Lets a 1 in connector clamp 3/4 in EMT. One per pipe per connection.',
    price: 0.15,
    basis: 'snapshot',
    pack: 1,
    vendor: 'makerpipe',
    url: P('1-to-3-4-emt-conduit-adapter-shim'),
  },
  {
    id: 'shim-tube',
    handle: '3-4-emt-conduit-adapter-shim',
    name: 'Pipe & Tube Adapter Shim',
    group: 'accessory',
    blurb: 'Fits 1 in Pro connectors to 3/4 in PVC, rigid conduit, black iron or galvanized pipe.',
    price: 0.15,
    basis: 'snapshot',
    pack: 1,
    sku: 'MP2045',
    vendor: 'makerpipe',
    url: P('3-4-emt-conduit-adapter-shim'),
  },
  {
    id: 'telescoping',
    handle: '1-2-to-3-4telescoping-connector',
    name: 'Telescoping Clamp',
    group: 'accessory',
    blurb: 'Slides 1/2 in EMT inside 3/4 in EMT and locks the height. For adjustable legs and poles.',
    price: 10.95,
    basis: 'snapshot',
    pack: 1,
    vendor: 'makerpipe',
    url: P('1-2-to-3-4telescoping-connector'),
  },

  // ---- Accessories ----
  {
    id: 'hardware',
    handle: 'hardware-electrical-conduit-projects',
    name: 'Extra Hardware',
    group: 'accessory',
    blurb: 'Spare M6 bolts and nuts for the connectors. 12 of each.',
    price: 2.95,
    basis: 'snapshot',
    pack: 12,
    vendor: 'makerpipe',
    url: P('hardware-electrical-conduit-projects'),
  },
  {
    id: 'quick-clamp',
    handle: 'quick-clamp',
    name: 'Quick Clamp',
    group: 'accessory',
    blurb: 'Replaces a connector bolt with a lever for tool-free, quick-release joints. Fits 3/4 in and 1 in connectors.',
    price: 2.95,
    basis: 'snapshot',
    pack: 1,
    vendor: 'makerpipe',
    url: P('quick-clamp'),
  },
  {
    id: 'inserts',
    handle: 'threaded-pipe-inserts',
    name: 'Threaded Pipe Inserts',
    group: 'accessory',
    blurb: 'Star-type inserts hammered into pipe ends to take 1/4-20 or 3/8-16 bolts, levelers or feet. 4 per pack.',
    ...sized(3.95, ['3/4', '1']),
    basis: 'snapshot',
    pack: 4,
    vendor: 'makerpipe',
    url: P('threaded-pipe-inserts'),
  },
  {
    id: 'friction',
    handle: 'friction-bands',
    name: 'Friction Bands',
    group: 'accessory',
    blurb: 'Self-adhesive bands that add grip inside a connector. 12 per pack.',
    price: 1.0,
    basis: 'snapshot',
    pack: 12,
    vendor: 'makerpipe',
    url: P('friction-bands'),
  },
  {
    id: 'screws',
    handle: 'self-drilling-screws',
    name: 'Self Drilling Screws',
    group: 'accessory',
    blurb: '#8 x 1/2 in self-tapping screws for pinning Pro connectors and couplings to the pipe.',
    price: null,
    basis: 'unknown',
    pack: 4,
    vendor: 'makerpipe',
    url: P('self-drilling-screws'),
  },
  {
    id: 'strap-mount',
    handle: 'conduit-mounting-straps',
    name: 'EMT Conduit Mounting Strap',
    group: 'accessory',
    blurb: 'Clamps a pipe with a flat edge and a pre-drilled hole, to fasten pipe to a surface.',
    price: 2.45,
    basis: 'snapshot',
    pack: 1,
    vendor: 'makerpipe',
    url: P('conduit-mounting-straps'),
  },
  {
    id: 'strap-1',
    handle: 'one-hole-straps',
    name: 'EMT Conduit One Hole Straps',
    group: 'accessory',
    blurb: 'Snap-on straps for fixing table tops and shelves to the frame. 4 per pack.',
    ...sized(1.95),
    basis: 'snapshot',
    priceNote: 'Low confidence: pack size and price were unclear in the snapshot.',
    pack: 4,
    vendor: 'makerpipe',
    url: P('one-hole-straps'),
  },
  {
    id: 'strap-2',
    handle: 'emt-conduit-two-hole-straps',
    name: 'EMT Conduit Two Hole Straps',
    group: 'accessory',
    blurb: 'Two-tab straps with pre-drilled holes. Screws not included. 4 per pack.',
    price: 1.95,
    basis: 'snapshot',
    priceNote: 'Low confidence: pack size and price were unclear in the snapshot.',
    pack: 4,
    vendor: 'makerpipe',
    url: P('emt-conduit-two-hole-straps'),
  },
  {
    id: 'shrink',
    handle: 'shrink-wrap',
    name: 'Shrink Wrap',
    group: 'accessory',
    blurb: 'UV-stable colour sleeve for 1/2 in and 3/4 in EMT, shrunk on with a heat gun. 10 ft length.',
    price: null,
    basis: 'unknown',
    pack: 1,
    sku: 'MP2004',
    video: 'https://www.youtube.com/watch?v=kfgGOgog8zg',
    vendor: 'makerpipe',
    url: P('shrink-wrap'),
  },

  // ---- Tools ----
  {
    id: 't-handle-short',
    handle: 't-handle-hex-wrench-short',
    name: 'T Handle Hex Wrench (Short)',
    group: 'tool',
    blurb: '5 mm ball-end T handle for the connector bolts.',
    price: 7.95,
    basis: 'snapshot',
    pack: 1,
    vendor: 'makerpipe',
    url: P('t-handle-hex-wrench-short'),
  },
  {
    id: 't-handle-long',
    handle: 't-handle-hex-wrench',
    name: 'T Handle Hex Wrench (Long)',
    group: 'tool',
    blurb: 'Long 5 mm ball-end T handle that reaches bolts at awkward angles.',
    price: 9.95,
    basis: 'snapshot',
    pack: 1,
    vendor: 'makerpipe',
    url: P('t-handle-hex-wrench'),
  },
  {
    id: 'allen',
    handle: 'simple-allen-key',
    name: 'Simple Allen Key',
    group: 'tool',
    blurb: 'Plain 5 mm hex key. Included with most bundles.',
    price: 1.45,
    basis: 'snapshot',
    pack: 1,
    vendor: 'makerpipe',
    url: P('simple-allen-key'),
  },
  {
    id: 'cutter',
    handle: 'emt-conduit-cutter',
    name: 'EMT Conduit Cutter',
    group: 'tool',
    blurb: 'Tube cutter with a hardened wheel and a side reamer for deburring. Rated for 1/8 in to 1-1/8 in OD.',
    price: 21.95,
    basis: 'snapshot',
    pack: 1,
    video: 'https://www.youtube.com/watch?v=Ly9uwKeCT-c',
    vendor: 'makerpipe',
    url: P('emt-conduit-cutter'),
  },
  {
    id: 'tool-bundle',
    handle: 'tool-bundle',
    name: 'Tool Bundle',
    group: 'tool',
    blurb: 'Pipe cutter, long T handle and a Maker Pipe tool belt.',
    price: 32.95,
    basis: 'snapshot',
    pack: 1,
    includes: ['EMT Conduit Cutter', 'T Handle Hex Wrench (Long)', 'Tool belt'],
    vendor: 'makerpipe',
    url: P('tool-bundle'),
  },
  {
    id: 'minis',
    handle: 'maker-pipe-minis',
    name: 'Maker Pipe Minis',
    group: 'tool',
    blurb: 'Plastic scale models of the connectors that fit coffee stirrers, for trying a build on the desk first.',
    price: 4.95,
    basis: 'snapshot',
    pack: 1,
    vendor: 'makerpipe',
    url: P('maker-pipe-minis'),
  },

  // ---- Bundles (3/4 in unless noted; 1/2 in versions ship with shims) ----
  bundle('b-sample', 'sample-bundle', 'Sample Bundle', 29.89, 33.53, 'One of each core connector, a short piece of conduit and an Allen key.', [
    ['t', 1], ['90', 1], ['180', 1], ['45', 1], ['adjustable', 1], ['flange', 1], ['allen', 1],
  ]),
  bundle('b-mixed', 'mixed-bundle', 'Mixed Bundle', 88.1, 96.54, 'A mix for a first project.', [['t', 12], ['90', 4], ['45', 4], ['180', 2]]),
  bundle('b-starter', 'starter-bundle', 'Starter Bundle', 148.15, 166.04, 'Every core connector type for small builds.', [
    ['t', 12], ['90', 8], ['45', 4], ['adjustable', 4], ['180', 4], ['allen', 1],
  ]),
  bundle('b-maker', 'maker-bundle-modular-pipe-connectors', 'Maker Bundle', 161.56, 179.52, '48 T Connectors.', [['t', 48]]),
  bundle('b-diy', 'diy-bundle', 'DIY Bundle', 247.48, 280.4, 'A broad mix including flanges.', [
    ['t', 24], ['90', 8], ['180', 6], ['45', 8], ['adjustable', 6], ['flange', 4], ['allen', 1],
  ]),
  bundle('b-pro', 'pro-bundle-structural-pipe-connector', 'Pro Bundle', 336.6, 374.0, '100 T Connectors and a short T handle.', [
    ['t', 100], ['t-handle-short', 1],
  ]),
  bundle('b-builder', 'builder-bundle', 'Builder Bundle', 382.08, 436.76, 'Large mixed set for furniture-sized builds.', [
    ['t', 60], ['90', 16], ['45', 8], ['180', 4], ['adjustable', 4], ['flange', 4], ['allen', 1],
  ]),
  bundle('b-creators', 'creators-bundle', "Creator's Bundle", 541.74, 617.06, 'Big mixed set.', [
    ['t', 84], ['90', 20], ['45', 10], ['180', 10], ['adjustable', 10], ['allen', 1],
  ]),
  bundle('b-anything', 'build-anything-bundle', 'Build Anything Bundle', 880.64, 998.68, 'The largest mixed set.', [
    ['t', 120], ['90', 48], ['180', 12], ['45', 12], ['adjustable', 12], ['flange', 8],
  ]),
  bundle('b-bigkit', 'big-kit-modular-pipe-connector', 'Big Kit', 951.9, 1002.0, '300 T Connectors and a short T handle.', [
    ['t', 300], ['t-handle-short', 1],
  ]),
  {
    id: 'b-lean',
    handle: 'lean-business-bundle',
    name: 'Lean Business Bundle',
    group: 'bundle',
    blurb: 'A few hundred discounted connectors and accessories for shops. Contents are listed on the store.',
    price: 2441.4,
    compareAt: 2724.5,
    basis: 'snapshot',
    pack: 1,
    vendor: 'makerpipe',
    url: P('lean-business-bundle'),
  },
  {
    id: 'b-biy',
    handle: 'build-it-yourself-connector-kit',
    name: 'Build It Yourself Maker Kit',
    group: 'bundle',
    blurb: '12 T, 4 90 Degree, 4 45 Degree and 2 180 Degree Connectors for 3/4 in EMT.',
    price: null,
    basis: 'unknown',
    pack: 1,
    bundle: [
      { productId: 't', qty: 12 },
      { productId: '90', qty: 4 },
      { productId: '45', qty: 4 },
      { productId: '180', qty: 2 },
    ],
    vendor: 'makerpipe',
    url: P('build-it-yourself-connector-kit'),
  },

  // ---- Project kits ----
  kit('k-desk', 'diy-pipe-desk-kit', 'DIY Pipe Desk Kit', 46.92, 'Connectors, straps and caps for a 48 x 24 in desk. Conduit and top not included.'),
  kit('k-countertop', 'diy-countertop-pipe-desk-kit', 'DIY Countertop Pipe Desk Kit', 79.28, 'Connectors for a countertop-height desk.'),
  kit('k-standing', 'standup-workstation-desk', 'DIY Standing Desk Kit', 142.47, 'Connectors for a standing workstation.'),
  kit('k-sling', 'signature-maker-pipe-sling-chair-kit', 'Sling Chair Kit', null, '14 T Connectors and a reversible canvas sling. Needs three 10 ft sticks of 3/4 in EMT.'),
  kit('k-canopy', 'tractor-canopy', 'DIY Tractor Canopy Kit', null, 'Connectors for a tractor sun canopy.'),

  // ---- Bought locally ----
  {
    id: 'emt',
    handle: '',
    name: 'EMT conduit, 10 ft stick',
    group: 'pipe',
    blurb: 'Electrical metallic tubing from any hardware store. Cut to length with a tube cutter.',
    sizes: CORE_SIZES,
    price: { '1/2': 7.57, '3/4': 12.63, '1': 21.98 },
    basis: 'snapshot',
    priceNote: "Lowe's prices from 2026 search snapshots. Prices vary by store and week.",
    pack: 1,
    vendor: 'local',
    url: 'https://www.lowes.com/pd/3-4-in-x-10-Feet-Metallic-EMT-Conduit/5013672205',
  },
];

function bundle(
  id: string,
  handle: string,
  name: string,
  price: number,
  compareAt: number,
  blurb: string,
  items: [string, number][],
): Product {
  return {
    id,
    handle,
    name,
    group: 'bundle',
    blurb,
    price,
    compareAt,
    basis: 'snapshot',
    pack: 1,
    bundle: items.map(([productId, qty]) => ({ productId, qty })),
    vendor: 'makerpipe',
    url: P(handle),
  };
}

function kit(id: string, handle: string, name: string, price: number | null, blurb: string): Product {
  return { id, handle, name, group: 'kit', blurb, price, basis: price === null ? 'unknown' : 'snapshot', pack: 1, vendor: 'makerpipe', url: P(handle) };
}

export const PRODUCT_BY_ID: Record<string, Product> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

/** Catalog product that supplies a connector, fitting or shim kind. */
export const PRODUCT_FOR_KIND: Record<string, Product> = Object.fromEntries(
  PRODUCTS.filter((p) => p.kind).map((p) => [p.kind!, p]),
);

export const SHIPPING_FLAT = 7.99;
export const SHIPPING_NOTE = 'Flat-rate figure reported by deal sites; check the store for current shipping.';

export const HARDWARE = {
  bolt: 'M6 socket-head bolt with a captive nut',
  tool: '5 mm hex (T handle or Allen key)',
  torque: '12 ft-lb',
};

// ---------------------------------------------------------------------------
// Live store data (scripts/sync-prices.mjs writes live-prices.json)

export interface LiveVariant {
  id: string;
  title: string;
  size?: PipeSize;
  color?: 'silver' | 'black';
  price: number;
  compareAt?: number | null;
  available?: boolean;
}

export interface LivePrices {
  fetchedAt: string | null;
  products: Record<string, { title?: string; variants: LiveVariant[] }>;
}

/** Read a size out of a Shopify variant title such as `3/4" / Silver` or `1 inch`. */
export function sizeFromTitle(title: string): PipeSize | undefined {
  const t = title.toLowerCase();
  if (/\b1\s*\/\s*2\b/.test(t)) return '1/2';
  if (/\b3\s*\/\s*4\b/.test(t)) return '3/4';
  if (/(^|[^\d/.])1(\s*(?:"|''|in\b|inch)|\s*$|\s*\/\s*[a-z])/.test(t)) return '1';
  return undefined;
}

export function colorFromTitle(title: string): 'silver' | 'black' | undefined {
  const t = title.toLowerCase();
  if (t.includes('black')) return 'black';
  if (t.includes('silver') || t.includes('zinc')) return 'silver';
  return undefined;
}

/**
 * Overlay live variant prices and ids onto the researched catalog.
 *
 * Many products list more options than the part itself: spare clamps
 * ("Middle Clamp", "Base Pieces Only"), B-stock, bundles "With" an add-on,
 * double and triple kits. The store lists its default option first, so for
 * each size and colour the first variant is the one priced and put in the
 * cart. Bundles are 3/4 in sets here, so they take the 3/4 in variant.
 */
export function applyLivePrices(products: Product[], data: LivePrices): Product[] {
  const fetched = data.fetchedAt;
  if (!fetched) return products;
  return products.map((p) => {
    const lp = p.handle ? data.products[p.handle] : undefined;
    if (!lp || !lp.variants.length) return p;
    type Picked = Omit<LiveVariant, 'color'> & { color: 'silver' | 'black' | 'any' };
    const first = new Map<string, Picked>();
    for (const v of lp.variants) {
      const size = v.size ?? sizeFromTitle(v.title);
      const color = v.color ?? colorFromTitle(v.title) ?? 'any';
      const key = `${size ?? 'any'}|${color}`;
      if (!first.has(key)) first.set(key, { ...v, size, color });
    }
    let picked = [...first.values()];
    if (p.group === 'bundle' && picked.some((v) => v.size)) {
      const set = picked.filter((v) => v.size === '3/4');
      picked = (set.length ? set : picked.slice(0, 1)).map((v) => ({ ...v, size: undefined }));
    }

    const next: Product = {
      ...p,
      basis: 'live',
      estimatedSizes: [],
      priceNote: `Live store price, fetched ${fetched.slice(0, 10)}.`,
    };
    const variants: NonNullable<Product['variants']> = {};
    const prices: Partial<Record<PipeSize, number>> = {};
    let flat: Picked | undefined;
    for (const v of picked) {
      const key = v.size ?? 'any';
      variants[key] = { ...variants[key], [v.color]: v.id };
      if (v.size) prices[v.size] ??= v.price;
      else flat ??= v;
    }
    const sizes = CORE_SIZES.filter((s) => s in prices);
    if (sizes.length) {
      next.price = prices;
      next.sizes = sizes;
    } else if (flat) {
      next.price = flat.price;
      next.compareAt = flat.compareAt && flat.compareAt > flat.price ? flat.compareAt : undefined;
    }
    next.variants = variants;
    const soldOut = picked.filter((v) => v.available === false).map((v) => v.id);
    next.soldOut = soldOut.length ? soldOut : undefined;
    return next;
  });
}

/** Whether the store has every variant for this size sold out (live data only). */
export function isSoldOut(p: Product, size?: PipeSize): boolean {
  const v = p.variants?.[size ?? 'any'] ?? p.variants?.any;
  const ids = Object.values(v ?? {});
  return ids.length > 0 && ids.every((id) => p.soldOut?.includes(id));
}

export const CATALOG: Product[] = applyLivePrices(PRODUCTS, live as LivePrices);
export const CATALOG_BY_ID: Record<string, Product> = Object.fromEntries(CATALOG.map((p) => [p.id, p]));
export const CATALOG_FOR_KIND: Record<string, Product> = Object.fromEntries(
  CATALOG.filter((p) => p.kind).map((p) => [p.kind!, p]),
);

/** Base catalog price for a product (per purchase unit) in a size, before user edits. */
export function basePrice(p: Product, size?: PipeSize): number | null {
  if (p.price === null || typeof p.price === 'number') return p.price;
  if (size && size in p.price) return p.price[size] ?? null;
  const vals = Object.values(p.price).filter((v): v is number => typeof v === 'number');
  return size ? null : vals.length ? Math.min(...vals) : null;
}

/** Whether a size's price is assumed from another size rather than seen. */
export const isEstimate = (p: Product, size?: PipeSize): boolean => !!size && !!p.estimatedSizes?.includes(size);

export const priceKey = (productId: string, size?: PipeSize) => `${productId}|${size ?? ''}`;

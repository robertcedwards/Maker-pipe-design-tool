# Pipe Frame Designer

A browser tool for planning builds with [Maker Pipe](https://makerpipe.com/collections/modular-pipe-fittings) connectors and ordinary EMT conduit. Draw a frame in 3D (or start from a template), and it works out:

- **which connector goes at every joint** (T, 90°, 180°, 135°, 4 Way, 5 Way, 45°, Adjustable Angle, Adjustable 180, Structural Coupling), plus flanges, end caps, rubber feet, casters and adapter shims;
- **a cut list** with each pipe's real cut length (allowing for how far it sits in its connectors), lettered parts, connector marks, and a plan for cutting everything from 10 ft sticks;
- **a priced parts list and order** for makerpipe.com and the hardware store, with bundle suggestions when a bundle is cheaper than singles;
- **step-by-step assembly instructions**, shown in the 3D view one step at a time.

It is an independent tool, not made by or affiliated with Maker Pipe.

## Using it

| | |
|---|---|
| Draw pipe | <kbd>P</kbd>, click a start point, click an end point. The pipe follows the X / Y / Z axis (or a 45° diagonal) nearest the cursor. Type a length such as `36`, `3'6"` or `900mm` and press <kbd>Enter</kbd> for an exact one. Ending on another pipe makes a joint. <kbd>Esc</kbd> stops. |
| Select and move | <kbd>V</kbd>, click pipes (<kbd>Shift</kbd>-click to add). Drag the gizmo, or use the arrow keys (<kbd>Shift</kbd>+↑↓ moves up and down). |
| Edit | <kbd>Del</kbd> delete, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicate, <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> undo and redo, <kbd>Ctrl</kbd>+<kbd>A</kbd> select all. |
| Joints | Click a connector to see what is there, choose which pipe runs through a corner, or switch to the Adjustable Angle Connector. |
| Views | <kbd>1</kbd> 3D, <kbd>2</kbd> top, <kbd>3</kbd> front, <kbd>4</kbd> side, <kbd>F</kbd> fit, <kbd>L</kbd> part labels. |
| Templates | <kbd>T</kbd>: shelving unit, workbench with 45° braces, cube, garment rack, greenhouse with a pitched roof. Every size is adjustable. |

Designs save automatically in the browser. **File** saves or opens a `.pipeframe.json` file, copies the design as text, or copies a share link.

The panel on the right has five tabs: **Design** (dimensions, checks, defaults, inspector), **Parts** (priced order and cart), **Cut list**, **Build** (instructions) and **Prices** (the whole catalog, editable).

## How joints become connectors

Pipes are drawn as centre lines. Wherever pipe ends meet, or a pipe end lands on another pipe, the analyser (`src/model/analyze.ts`) looks at the directions involved:

- One pipe that **passes through** the point takes the connector's clamp; the pipe **ends** at the point go into its sleeves. Ends square to the through pipe are matched to T (1), 90° (2 at right angles), 180° (2 opposite), 135° (2 at 135°), 4 Way (3) and 5 Way (4). Tilted ends use the 45° or Adjustable Angle connector, or the Adjustable 180 for two tilted ends on opposite sides.
- Where **every pipe ends** (an elbow or a box corner), one of them is promoted to run through the connector and is cut about 1" longer. Posts whose top is at the joint are preferred, then X rails, then Z rails, so each rectangle gets two long and two short sides. You can override this per joint.
- Two ends in a straight line get a **Structural Coupling**. Smaller pipe in a larger connector gets an **adapter shim**.
- Anything that no single connector can do is reported: pipes crossing without a joint, several connectors needed at one spot, connectors whose clamps overlap, pipes too short to grip or longer than a 10 ft stick, and sizes a connector is not sold in.

Cut lengths subtract how far a pipe end stops short of the joint centre (half the through pipe's diameter for square joints, more for angled and hinged ones) and add the overhang on promoted pipes. Maker Pipe does not publish connector drawings, so these allowances are estimates (`src/catalog/emt.ts`). The cut list says to cut angled pipes slightly long and trim to fit.

## Prices and ordering

The catalog (`src/catalog/catalog.ts`) lists every item in the Modular Pipe Fittings & Accessories collection: connectors, flanges, caps, feet, casters, shims, clamps, straps, inserts, tools, bundles and project kits, plus EMT sticks from the hardware store.

The prices were gathered on 2026-09-27 from search-engine snapshots of the store, because the store could not be fetched directly from the environment this was built in. Each price carries a basis that the UI shows:

- **verified**: matches the store's bundle prices (each bundle's regular price is the sum of its connectors);
- **snapshot**: seen in a snapshot of the product page;
- **est.**: only one price was shown, so 1/2" and 1" are assumed to match 3/4";
- **no price**: not found; the item is listed but left out of totals.

Anyone can correct a price on the **Prices** tab; the totals use the edits.

### Refreshing prices and enabling the cart link

```sh
npm run sync-prices
```

This fetches `https://makerpipe.com/products/<handle>.js` for every catalog item and writes current prices and Shopify variant ids to `src/catalog/live-prices.json`. The app overlays that file on the catalog, marks those prices **live**, and the Parts tab's order button becomes "Add everything to the makerpipe.com cart" (a standard Shopify cart link, e.g. `https://makerpipe.com/cart/<variant>:<qty>,…`). The script also lists collection products the catalog does not know about yet. Commit the updated JSON and rebuild.

Until the sync has run, the order button opens the store collection, and **Copy parts list** / **Download CSV** give you the list to order from.

## Development

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (connector rules, cut list, BOM, instructions, parsing)
npm run typecheck
npm run build        # static site in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

Built with React 19, Three.js through React Three Fiber and drei, zustand and Vite. Node 22.18 or newer.

```
src/
  model/        design types, joint analysis, cut list, bill of materials, instructions, templates, units
  catalog/      product catalog, EMT dimensions, Shopify parsing, live price overlay
  state/        store (undo history, persistence), derived data, file import/export
  three/        3D viewport, procedural pipe/connector meshes, drawing tool, labels
  ui/           panels, tabs, dialogs, icons and product glyphs
scripts/
  sync-prices.mjs
```

### Deploying

`dist/` is a static site that works from any path. The **Deploy to GitHub Pages** workflow in `.github/workflows/pages.yml` publishes it on every push to `main`, so merging a pull request updates the site. It needs Pages enabled for the repository (Settings › Pages › Source: GitHub Actions). To redeploy without a new commit, open the workflow on the Actions tab and click **Run workflow**.

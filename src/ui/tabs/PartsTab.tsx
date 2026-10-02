import { COLLECTION_URL, SHIPPING_NOTE, pricesGatheredLabel } from '../../catalog/catalog';
import { type BomLine, type ToolChoice, cartLink, orderCsv, orderText } from '../../model/bom';
import { formatMoney } from '../../model/units';
import { useDerived } from '../../state/derived';
import { useStore } from '../../state/store';
import { Glyph } from '../Glyph';
import { Icon } from '../icons';
import { copyText, saveFile, slug, useCanSaveFiles } from '../util';

const BASIS_CHIP: Record<string, { cls: string; text: string; title: string } | undefined> = {
  estimate: { cls: 'warning', text: 'est.', title: 'Only the 3/4" price was found; this size is assumed to cost the same.' },
  unknown: { cls: 'error', text: 'no price', title: 'No price found. Not included in the total.' },
  edited: { cls: 'accent', text: 'edited', title: 'You changed this price on the Prices tab.' },
  live: { cls: 'ok', text: 'live', title: 'Fetched from the store.' },
};

function sourceText(l: BomLine): string | null {
  if (l.source === 'spare') return 'spare';
  if (l.source === 'tool') return 'tool';
  if (l.source === 'extra') return 'added by you';
  if (l.source === 'bundle') return 'bundle';
  return null;
}

function Line({ l }: { l: BomLine }) {
  const chip = l.total === null ? BASIS_CHIP.unknown : l.basis === 'edited' ? BASIS_CHIP.edited : l.estimate ? BASIS_CHIP.estimate : l.basis === 'live' ? BASIS_CHIP.live : undefined;
  const src = sourceText(l);
  return (
    <div className="line">
      <Glyph id={l.productId} />
      <div style={{ minWidth: 0 }}>
        <div className="line-name">
          {l.url ? (
            <a href={l.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
              {l.name}
            </a>
          ) : (
            l.name
          )}
        </div>
        <div className="line-sub">
          {l.size && <span>{l.size}"</span>}
          {l.pack > 1 && (
            <span>
              {l.needed} needed · packs of {l.pack}
            </span>
          )}
          {l.productId === 'emt' && <span>10 ft sticks</span>}
          {src && <span>· {src}</span>}
          {chip && (
            <span className={`chip ${chip.cls}`} title={chip.title}>
              {chip.text}
            </span>
          )}
          {l.soldOut && (
            <span className="chip warning" title="The store lists this as sold out, so it is left out of the cart link.">
              sold out
            </span>
          )}
        </div>
      </div>
      <div className="line-price">
        {l.total === null ? '—' : formatMoney(l.total)}
        <span className="qty">
          {l.qty} × {l.unitPrice === null ? '—' : formatMoney(l.unitPrice)}
        </span>
      </div>
    </div>
  );
}

export function PartsTab() {
  const { design, bom } = useDerived();
  const order = useStore((s) => s.order);
  const { setOrder, notify, setTab } = useStore.getState();
  const canSave = useCanSaveFiles();
  const store = bom.lines.filter((l) => l.vendor === 'makerpipe');
  const local = bom.lines.filter((l) => l.vendor === 'local');
  const cart = cartLink(bom);
  const s = bom.suggestion;

  if (!design.pipes.length) {
    return (
      <div className="panel-body">
        <div className="empty">Add some pipes and the parts list appears here.</div>
      </div>
    );
  }

  return (
    <div className="panel-body">
      <div className="total-block">
        <div className="big">
          <span className="eyebrow">Estimated total</span>
          <span className="num">{formatMoney(bom.total)}</span>
        </div>
        <span className="k">Maker Pipe parts</span>
        <span className="v">{formatMoney(bom.makerpipeSubtotal)}</span>
        {bom.shipping > 0 && (
          <>
            <span className="k" title={SHIPPING_NOTE}>
              Shipping (flat rate, estimate)
            </span>
            <span className="v">{formatMoney(bom.shipping)}</span>
          </>
        )}
        <span className="k">EMT from the hardware store</span>
        <span className="v">{formatMoney(bom.localSubtotal)}</span>
        {bom.unpriced.length > 0 && (
          <span className="k small" style={{ gridColumn: '1 / -1', color: 'var(--error)' }}>
            Not in the total (no listed price): {bom.unpriced.map((l) => l.name).join(', ')}
          </span>
        )}
      </div>

      {s && (
        <div className="callout">
          <div className="grow">
            <b>
              Save {formatMoney(s.savings)} with {s.qty > 1 ? `${s.qty} × ` : ''}the {s.name}
            </b>
            <div className="small">
              It covers {s.qty > 1 ? 'these' : 'most of'} your 3/4" connectors
              {s.spare > 0 ? ` and leaves ${s.spare} spare for the next build` : ''}. Singles fill the gaps.
            </div>
          </div>
          <button className="btn primary small" onClick={() => setOrder({ bundle: { productId: s.productId, qty: s.qty } })}>
            Use bundle
          </button>
        </div>
      )}
      {order.bundle && (
        <div className="callout plain">
          <div className="grow small">Buying a bundle in place of single 3/4" connectors.</div>
          <button className="btn small" onClick={() => setOrder({ bundle: null })}>
            Buy singles instead
          </button>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <h3>From makerpipe.com</h3>
          <span className="num small muted">{formatMoney(bom.makerpipeSubtotal)}</span>
        </div>
        <div className="lines">
          {store.map((l) => (
            <Line key={l.key} l={l} />
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h3>From the hardware store</h3>
          <span className="num small muted">{formatMoney(bom.localSubtotal)}</span>
        </div>
        <div className="lines">
          {local.map((l) => (
            <Line key={l.key} l={l} />
          ))}
        </div>
        <p className="note">
          Cut plan and offcuts are on the{' '}
          <button className="link-btn" onClick={() => setTab('cut')}>
            Cut list
          </button>{' '}
          tab.
        </p>
      </div>

      <div className="section">
        <h3>Order options</h3>
        <div className="field">
          <label htmlFor="tool-choice">Wrench</label>
          <select id="tool-choice" value={order.tool} onChange={(e) => setOrder({ tool: e.target.value as ToolChoice })}>
            <option value="short">T Handle (short)</option>
            <option value="long">T Handle (long, ball end)</option>
            <option value="allen">Simple Allen key</option>
            <option value="none">I have a 5 mm hex key</option>
          </select>
        </div>
        <label className="check" htmlFor="opt-cutter">
          <input id="opt-cutter" type="checkbox" checked={order.cutter} onChange={(e) => setOrder({ cutter: e.target.checked })} />
          Add the EMT Conduit Cutter
        </label>
        <label className="check" htmlFor="opt-spares">
          <input id="opt-spares" type="checkbox" checked={order.spares} onChange={(e) => setOrder({ spares: e.target.checked })} />
          One spare of each connector
        </label>
        <label className="check" htmlFor="opt-ship">
          <input id="opt-ship" type="checkbox" checked={order.shipping} onChange={(e) => setOrder({ shipping: e.target.checked })} />
          Include estimated shipping
        </label>
        <p className="note">
          More accessories (quick clamps, straps, threaded inserts, shrink wrap) are on the{' '}
          <button className="link-btn" onClick={() => setTab('catalog')}>
            Prices
          </button>{' '}
          tab.
        </p>
      </div>

      <div className="section">
        <h3>Order</h3>
        {cart.url ? (
          <a className="btn primary" href={cart.url} target="_blank" rel="noreferrer">
            <Icon.cart /> Add everything to the makerpipe.com cart
          </a>
        ) : (
          <a className="btn primary" href={COLLECTION_URL} target="_blank" rel="noreferrer">
            <Icon.cart /> Shop Modular Pipe Fittings on makerpipe.com
          </a>
        )}
        {cart.url && cart.missing.length > 0 && (
          <p className="note">Add these by hand: {cart.missing.map((l) => l.name).join(', ')}.</p>
        )}
        {cart.soldOut.length > 0 && (
          <p className="note">
            Sold out on the store, so not in the cart:{' '}
            {cart.soldOut.map((l) => `${l.name}${l.size ? ` ${l.size}"` : ''}`).join(', ')}.
          </p>
        )}
        <div className="row">
          <button
            className="btn"
            onClick={async () => notify((await copyText(orderText(design.name, bom))) ? 'Parts list copied' : 'Copy failed: your browser blocked the clipboard')}
          >
            <Icon.clipboard /> Copy parts list
          </button>
          {canSave && (
            <button
              className="btn"
              onClick={async () => {
                const msg = await saveFile(`${slug(design.name)}-parts.csv`, orderCsv(bom), 'text/csv');
                if (msg) notify(msg);
              }}
            >
              <Icon.download /> Download CSV
            </button>
          )}
        </div>
        <p className="note">
          Prices were gathered on {pricesGatheredLabel()} and may have changed. Each item name links to its store page; check the cart before you pay. This tool is not
          made by Maker Pipe.
        </p>
      </div>
    </div>
  );
}

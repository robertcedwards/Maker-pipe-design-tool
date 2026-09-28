import { useEffect, useRef } from 'react';
import { CATALOG_FOR_KIND } from '../../catalog/catalog';
import { formatLength } from '../../model/units';
import type { V3 } from '../../model/vec';
import { useDerived } from '../../state/derived';
import { useStore } from '../../state/store';
import { Glyph } from '../Glyph';
import { Icon } from '../icons';
import { EMBEDDED, copyText, saveFile, slug, useCanSaveFiles } from '../util';
import { buildMarkdown } from '../../model/exportDoc';

export function BuildTab() {
  const { steps, analysis, design, plan, bom } = useDerived();
  const step = useStore((s) => s.step);
  const units = useStore((s) => s.units);
  const { setStep, frame, notify } = useStore.getState();
  const canSave = useCanSaveFiles();
  const current = Math.min(step, Math.max(0, steps.length - 1));
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    refs.current[current]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  if (!design.pipes.length) {
    return (
      <div className="panel-body">
        <div className="empty">Add some pipes and step-by-step build instructions appear here.</div>
      </div>
    );
  }

  const zoomTo = (i: number) => {
    const s = steps[i];
    const pts: V3[] = [];
    for (const id of s.pipeIds) {
      const info = analysis.pipes[id];
      if (info) pts.push(info.physA, info.physB);
    }
    for (const id of s.fittingIds) {
      const f = analysis.fittings.find((x) => x.id === id);
      if (f) pts.push(f.pos);
    }
    frame(pts.length ? pts : null);
  };

  return (
    <div className="panel-body">
      <div className="section">
        <div className="section-head">
          <h2>Build steps</h2>
          <div className="row">
            <button className="btn small" disabled={current === 0} onClick={() => setStep(current - 1)} aria-label="Previous step">
              <Icon.left />
            </button>
            <span className="step-count">
              {current + 1} / {steps.length}
            </span>
            <button className="btn small" disabled={current >= steps.length - 1} onClick={() => setStep(current + 1)} aria-label="Next step">
              <Icon.right />
            </button>
            {!EMBEDDED && (
              <button className="btn small no-print" onClick={() => window.print()}>
                Print
              </button>
            )}
          </div>
        </div>
        <p className="note">
          The 3D view follows the steps: new parts are yellow, finished ones grey, later ones faint. Use the arrows here or under
          the view.
        </p>
        <div className="row no-print">
          <button
            className="btn small"
            onClick={async () =>
              notify((await copyText(buildMarkdown(design, analysis, plan, bom, steps, units))) ? 'Build sheet copied' : 'Copy failed: your browser blocked the clipboard')
            }
          >
            <Icon.clipboard /> Copy build sheet
          </button>
          {canSave && (
            <button
              className="btn small"
              onClick={async () => {
                const msg = await saveFile(`${slug(design.name)}-build-sheet.md`, buildMarkdown(design, analysis, plan, bom, steps, units), 'text/markdown');
                if (msg) notify(msg);
              }}
            >
              <Icon.download /> Save build sheet
            </button>
          )}
        </div>
      </div>
      <ol className="steps">
        {steps.map((s, i) => {
          const open = i === current;
          return (
            <li
              key={s.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className={`step${i < current ? ' done' : ''}`}
              aria-current={open ? 'step' : undefined}
            >
              <button className="step-button" onClick={() => setStep(i)} aria-expanded={open}>
                <span className="step-num">{i + 1}</span>
                <span className="step-name">{s.title}</span>
                <span className="small muted">
                  {s.pipeIds.length > 0 ? `${s.pipeIds.length} pipe${s.pipeIds.length > 1 ? 's' : ''}` : ''}
                </span>
              </button>
              {(
                <div className="step-detail">
                  {s.parts.length > 0 && (
                    <div className="chips">
                      {s.parts.map((p) => (
                        <span className="part-chip" key={p.mark}>
                          <span className="part-mark">{p.mark}</span>
                          <span className="mono">
                            {p.count} × {formatLength(p.length, units, { feet: false })}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                  {s.connectors.length > 0 && (
                    <div className="chips">
                      {s.connectors.map((c) => (
                        <span className="connector-chip" key={`${c.kind}${c.size}`}>
                          <Glyph id={CATALOG_FOR_KIND[c.kind].id} />
                          {c.count} × {c.name} <span className="muted">{c.size}"</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <ul>
                    {s.lines
                      .filter((l) => !(s.parts.length && l.startsWith('Parts:')) && !(s.connectors.length && l.startsWith('Connectors:')))
                      .map((l, k) => (
                        <li key={k}>{l}</li>
                      ))}
                  </ul>
                  {(s.pipeIds.length > 0 || s.fittingIds.length > 0) && (
                    <div className="row no-print">
                      <button className="btn small" onClick={() => zoomTo(i)}>
                        <Icon.fit /> Zoom to this step
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

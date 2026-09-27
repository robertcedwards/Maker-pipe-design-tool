import { bounds } from '../model/analyze';
import { PIPE_SIZES } from '../model/types';
import { SNAP_STEPS, formatLength } from '../model/units';
import { useDerived } from '../state/derived';
import { useStore } from '../state/store';
import { Icon } from './icons';

export function DrawBar() {
  const tool = useStore((s) => s.tool);
  const drawSize = useStore((s) => s.drawSize);
  const snap = useStore((s) => s.snap);
  const units = useStore((s) => s.units);
  const allow45 = useStore((s) => s.allow45);
  const setPrefs = useStore((s) => s.setPrefs);
  if (tool !== 'draw') return null;
  const steps = SNAP_STEPS[units];
  const current = steps.find((s) => Math.abs(s.inches - snap) < 1e-6) ? snap : steps[2].inches;
  return (
    <>
      <div className="card draw-bar">
        <span className="field-inline">
          Pipe
          <span className="seg" role="group" aria-label="Pipe size for new pipes">
            {PIPE_SIZES.map((s) => (
              <button key={s} aria-pressed={drawSize === s} onClick={() => setPrefs({ drawSize: s })}>
                {s}"
              </button>
            ))}
          </span>
        </span>
        <label className="field-inline" htmlFor="snap-step">
          Snap
          <select id="snap-step" value={current} onChange={(e) => setPrefs({ snap: Number(e.target.value) })}>
            {steps.map((s) => (
              <option key={s.label} value={s.inches}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="check" htmlFor="allow-45">
          <input id="allow-45" type="checkbox" checked={allow45} onChange={(e) => setPrefs({ allow45: e.target.checked })} />
          45° lines
        </label>
      </div>
      <div className="card draw-hint">
        Click a point, then click where the pipe ends. Type a length and press <kbd>Enter</kbd> for an exact one. End on another
        pipe to join it. <kbd>Esc</kbd> stops drawing.
      </div>
    </>
  );
}

export function StatusBar() {
  const { analysis, design } = useDerived();
  const units = useStore((s) => s.units);
  const setTab = useStore((s) => s.setTab);
  const b = bounds(analysis);
  const errors = analysis.issues.filter((i) => i.level === 'error').length;
  const warnings = analysis.issues.filter((i) => i.level === 'warning').length;
  const L = (x: number) => formatLength(x, units, { feet: false });
  return (
    <div className="card stats" aria-live="polite">
      <span className="stat">
        Size{' '}
        <b>{b ? `${L(b.size[0])} W × ${L(b.size[2])} D × ${L(b.size[1])} H` : '—'}</b>
      </span>
      <span className="stat">
        <b>{design.pipes.length}</b> pipes
      </span>
      <span className="stat">
        <b>{analysis.connectors.length}</b> connectors
      </span>
      {errors + warnings > 0 ? (
        <button className={`chip ${errors ? 'error' : 'warning'}`} onClick={() => setTab('design')}>
          {errors ? `${errors} ${errors === 1 ? 'problem' : 'problems'}` : ''}
          {errors && warnings ? ' · ' : ''}
          {warnings ? `${warnings} ${warnings === 1 ? 'warning' : 'warnings'}` : ''}
        </button>
      ) : design.pipes.length ? (
        <span className="chip ok">Buildable</span>
      ) : null}
    </div>
  );
}

export function StepNav() {
  const { steps } = useDerived();
  const tab = useStore((s) => s.tab);
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);
  if (tab !== 'build' || !steps.length) return null;
  const i = Math.min(step, steps.length - 1);
  return (
    <div className="card step-nav">
      <button className="icon-btn" aria-label="Previous step" disabled={i === 0} onClick={() => setStep(i - 1)}>
        <Icon.left />
      </button>
      <div style={{ minWidth: 0 }}>
        <div className="step-count">
          Step {i + 1} of {steps.length}
        </div>
        <div className="step-title">{steps[i].title}</div>
      </div>
      <button className="icon-btn" aria-label="Next step" disabled={i >= steps.length - 1} onClick={() => setStep(i + 1)}>
        <Icon.right />
      </button>
    </div>
  );
}

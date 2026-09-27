import { EMT, STICK_LENGTH } from '../../catalog/emt';
import { PIPE_SIZES } from '../../model/types';
import { formatLength } from '../../model/units';
import { useDerived } from '../../state/derived';
import { useStore } from '../../state/store';

export function CutTab() {
  const { plan, bom, design } = useDerived();
  const units = useStore((s) => s.units);
  const kerf = useStore((s) => s.kerf);
  const selection = useStore((s) => s.selection);
  const { setPrefs, select } = useStore.getState();
  const L = (x: number) => formatLength(x, units, { feet: false });
  const selectedMarks = new Set(selection.map((id) => plan.partByPipe[id]?.mark));

  if (!design.pipes.length) {
    return (
      <div className="panel-body">
        <div className="empty">Add some pipes and the cut list appears here.</div>
      </div>
    );
  }

  return (
    <div className="panel-body">
      <div className="section">
        <div className="section-head">
          <h2>Cut list</h2>
          <span className="small muted">{plan.parts.reduce((s, p) => s + p.pipeIds.length, 0)} pieces</span>
        </div>
        <div className="table-wrap">
          <table className="parts-table">
            <thead>
              <tr>
                <th>Part</th>
                <th>EMT</th>
                <th className="num">Cut to</th>
                <th className="num">Qty</th>
                <th>Connector marks</th>
              </tr>
            </thead>
            <tbody>
              {plan.parts.map((p) => (
                <tr key={p.mark} onClick={() => select(p.pipeIds)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span className={`part-mark${selectedMarks.has(p.mark) ? ' sel' : ''}`}>{p.mark}</span>
                  </td>
                  <td>{p.size}"</td>
                  <td className="num mono">{L(p.length)}</td>
                  <td className="num mono">{p.pipeIds.length}</td>
                  <td className="mono small">{p.marks.length ? p.marks.map(L).join(', ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          Cut lengths already allow for how deep each pipe sits in its connector, so measure the pipe itself. Marks are connector
          centres, measured from one end. Angled pipes are approximate: cut them 1/4" long and trim to fit.
        </p>
      </div>

      {PIPE_SIZES.filter((s) => plan.sticksBySize[s]).map((size) => {
        const sticks = plan.sticks.filter((s) => s.size === size);
        const offcut = sticks.reduce((s, x) => s + x.offcut, 0);
        return (
          <div className="section" key={size}>
            <div className="section-head">
              <h3>
                {plan.sticksBySize[size]} × {EMT[size].label}, 10 ft
              </h3>
              <span className="small muted">
                {L(plan.totalLengthBySize[size] ?? 0)} used · {L(offcut)} offcut
              </span>
            </div>
            {sticks.map((s, i) => (
              <div className="stick" key={i}>
                <div className="stick-head">
                  <span>Stick {i + 1}</span>
                  <span className="mono">{s.offcut > 0.5 ? `${L(s.offcut)} left` : 'no offcut'}</span>
                </div>
                <div className="stick-bar" role="img" aria-label={`Stick ${i + 1}: ${s.cuts.map((c) => `${c.mark} ${L(c.length)}`).join(', ')}`}>
                  {s.cuts.map((c, k) => (
                    <div
                      key={k}
                      className="stick-cut"
                      style={{ width: `${(c.length / STICK_LENGTH) * 100}%` }}
                      title={`${c.mark}: ${L(c.length)}`}
                    >
                      {c.length / STICK_LENGTH > 0.06 ? c.mark : ''}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="stick-scale" aria-hidden="true">
              <span>0</span>
              <span>{units === 'metric' ? '1524 mm' : '5 ft'}</span>
              <span>{units === 'metric' ? '3048 mm' : '10 ft'}</span>
            </div>
            {plan.overLength.some((id) => plan.partByPipe[id].size === size) && (
              <p className="note" style={{ color: 'var(--error)' }}>
                Some pipes are longer than one stick. Split them and join the pieces with a Structural Coupling.
              </p>
            )}
          </div>
        );
      })}

      <div className="section">
        <div className="field">
          <label htmlFor="kerf">Saw kerf</label>
          <select id="kerf" value={kerf} onChange={(e) => setPrefs({ kerf: Number(e.target.value) })}>
            <option value={0}>None (tube cutter)</option>
            <option value={0.0625}>1/16" (hacksaw)</option>
            <option value={0.125}>1/8" (chop saw)</option>
          </select>
        </div>
        <p className="note">
          The pipe weighs about <b className="mono">{bom.pipeWeightLb.toFixed(1)} lb</b> before connectors.
        </p>
      </div>
    </div>
  );
}

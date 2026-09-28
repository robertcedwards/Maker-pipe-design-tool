import { useEffect, useState } from 'react';
import { CATALOG_FOR_KIND } from '../../catalog/catalog';
import { EMT, overhang } from '../../catalog/emt';
import { type Analysis, type PipeEnd, bounds } from '../../model/analyze';
import { END_FITTINGS, PIPE_SIZES, type Issue, type Pipe } from '../../model/types';
import { formatLength, parseLength } from '../../model/units';
import { type V3, dist, sub } from '../../model/vec';
import { useDerived } from '../../state/derived';
import { endFittingOf, useStore } from '../../state/store';
import { Glyph } from '../Glyph';
import { Icon } from '../icons';
import { END_LABEL } from '../util';

export function DesignTab() {
  const { analysis } = useDerived();
  const selection = useStore((s) => s.selection);
  const joint = useStore((s) => s.selectedJoint);
  if (joint && analysis.jointsByKey[joint]) return <JointInspector jointKey={joint} />;
  if (selection.length) return <PipeInspector ids={selection} />;
  return <Overview />;
}

function axisLabel(a: V3, b: V3): string {
  const d = sub(b, a);
  const nz = d.map((x) => Math.abs(x) > 1e-6);
  const count = nz.filter(Boolean).length;
  if (count === 1) return nz[0] ? 'along X (width)' : nz[1] ? 'vertical' : 'along Z (depth)';
  return 'at an angle';
}

function IssueList({ issues, analysis }: { issues: Issue[]; analysis: Analysis }) {
  const { select, frame } = useStore.getState();
  const sorted = [...issues].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
  return (
    <div className="issues">
      {sorted.map((i, n) => (
        <button
          key={n}
          className={`issue ${i.level}`}
          onClick={() => {
            if (i.pipeIds?.length) select(i.pipeIds);
            const pts: V3[] = [];
            for (const id of i.pipeIds ?? []) {
              const info = analysis.pipes[id];
              if (info) pts.push(info.physA, info.physB);
            }
            if (i.pos) pts.push(i.pos);
            if (pts.length) frame(pts);
          }}
        >
          <span className={`chip ${i.level}`}>{i.level === 'error' ? 'Problem' : 'Warning'}</span>
          <span>{i.message}</span>
        </button>
      ))}
    </div>
  );
}

function Overview() {
  const { design, analysis, bom, plan } = useDerived();
  const units = useStore((s) => s.units);
  const drawSize = useStore((s) => s.drawSize);
  const { setDesignField, setPrefs, setTool, setTemplateOpen } = useStore.getState();
  const b = bounds(analysis);
  const L = (x: number) => formatLength(x, units, { feet: false });
  const totalLen = Object.values(plan.totalLengthBySize).reduce((s, x) => s + (x ?? 0), 0);
  const issues = [...analysis.issues, ...bom.issues];

  if (!design.pipes.length) {
    return (
      <div className="panel-body">
        <div className="section">
          <h2>Start a frame</h2>
          <p className="note">
            Draw pipes in the 3D view, or start from a template and change its size. Connectors, cut lengths, prices and build
            steps update as you go.
          </p>
          <div className="row">
            <button className="btn primary" onClick={() => setTemplateOpen(true)}>
              <Icon.templates /> Choose a template
            </button>
            <button className="btn" onClick={() => setTool('draw')}>
              <Icon.pipe /> Draw pipes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-body">
      <div className="section">
        <div className="section-head">
          <h2>{design.name}</h2>
          <span className="small muted">Outside size</span>
        </div>
        <div className="kv">
          <div>
            <span className="k">Width</span>
            <span className="v">{b ? L(b.size[0]) : '—'}</span>
          </div>
          <div>
            <span className="k">Depth</span>
            <span className="v">{b ? L(b.size[2]) : '—'}</span>
          </div>
          <div>
            <span className="k">Height</span>
            <span className="v">{b ? L(b.size[1]) : '—'}</span>
          </div>
          <div>
            <span className="k">Pipe</span>
            <span className="v">{units === 'metric' ? `${((totalLen * 25.4) / 1000).toFixed(1)} m` : `${(totalLen / 12).toFixed(1)} ft`}</span>
          </div>
          <div>
            <span className="k">Connectors</span>
            <span className="v">{analysis.connectors.length}</span>
          </div>
          <div>
            <span className="k">Bolts</span>
            <span className="v">{bom.bolts}</span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h3>Checks</h3>
          {!issues.length && <span className="chip ok">No problems found</span>}
        </div>
        {issues.length ? (
          <IssueList issues={issues} analysis={analysis} />
        ) : (
          <p className="note">Every joint maps to a connector Maker Pipe sells, and every pipe fits on a 10 ft stick.</p>
        )}
      </div>

      <div className="section">
        <h3>Defaults</h3>
        <div className="field">
          <label htmlFor="default-end">Open pipe ends</label>
          <select id="default-end" value={design.defaultEnd} onChange={(e) => setDesignField('defaultEnd', e.target.value as Pipe['endA'] & string)}>
            {END_FITTINGS.map((f) => (
              <option key={f} value={f}>
                {END_LABEL[f]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span>Connector finish</span>
          <span className="seg" role="group" aria-label="Connector finish">
            <button aria-pressed={(design.finish ?? 'silver') === 'silver'} onClick={() => setDesignField('finish', 'silver')}>
              Zinc
            </button>
            <button aria-pressed={design.finish === 'black'} onClick={() => setDesignField('finish', 'black')}>
              Black
            </button>
          </span>
        </div>
        <div className="field">
          <span>New pipe size</span>
          <span className="seg" role="group" aria-label="Pipe size for new pipes">
            {PIPE_SIZES.map((s) => (
              <button key={s} aria-pressed={drawSize === s} onClick={() => setPrefs({ drawSize: s })}>
                {s}"
              </button>
            ))}
          </span>
        </div>
      </div>

      <div className="section">
        <h3>Editing</h3>
        <ul className="note" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          <li>
            <kbd>P</kbd> draws pipe: click a start, click an end. Type a length and <kbd>Enter</kbd> for an exact one.
          </li>
          <li>
            <kbd>V</kbd> selects. Click a pipe or connector; <kbd>Shift</kbd>-click adds to the selection. Drag the arrows to
            move, or use the arrow keys (<kbd>Shift</kbd> + ↑↓ for up and down).
          </li>
          <li>
            <kbd>Del</kbd> deletes, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicates, <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes.
          </li>
          <li>Drag to orbit, right-drag to pan, scroll to zoom.</li>
        </ul>
      </div>
    </div>
  );
}

function endText(end: PipeEnd, analysis: Analysis, units: 'imperial' | 'metric', size: Pipe['size']): string {
  if (end.hold === 'free') return '';
  const j = end.jointKey ? analysis.jointsByKey[end.jointKey] : undefined;
  const names = j ? j.connectorIds.map((id) => CATALOG_FOR_KIND[analysis.connectorsById[id].kind].name) : [];
  const name = [...new Set(names)].join(' + ') || 'connector';
  if (end.hold === 'overhang') return `Runs through the ${name}, ${formatLength(overhang(size), units)} past centre`;
  if (end.hold === 'coupling') return `Spliced with a ${name}`;
  return `Ends in the ${name}`;
}

function LengthField({ pipe }: { pipe: Pipe }) {
  const units = useStore((s) => s.units);
  const setPipeLength = useStore((s) => s.setPipeLength);
  const notify = useStore((s) => s.notify);
  const len = dist(pipe.a, pipe.b);
  const [text, setText] = useState(formatLength(len, units, { feet: false }));
  useEffect(() => setText(formatLength(len, units, { feet: false })), [len, units]);
  const apply = () => {
    const v = parseLength(text, units);
    if (v === null || v < 0.5) {
      notify('Enter a length such as 36, 36", 3\' 6" or 900mm');
      setText(formatLength(len, units, { feet: false }));
      return;
    }
    if (Math.abs(v - len) > 1e-4) setPipeLength(pipe.id, v);
  };
  return (
    <input
      id="pipe-length"
      className="input mono"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={apply}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      aria-label="Centre-to-centre length"
    />
  );
}

function PipeInspector({ ids }: { ids: string[] }) {
  const { design, analysis, plan } = useDerived();
  const units = useStore((s) => s.units);
  const { updatePipes, deletePipes, duplicate, splitPipe, select, frame } = useStore.getState();
  const pipes = design.pipes.filter((p) => ids.includes(p.id));
  if (!pipes.length) return null;
  const single = pipes.length === 1 ? pipes[0] : null;
  const sizes = new Set(pipes.map((p) => p.size));
  const marks = [...new Set(pipes.map((p) => plan.partByPipe[p.id]?.mark).filter(Boolean))].sort();
  const info = single ? analysis.pipes[single.id] : null;
  const part = single ? plan.partByPipe[single.id] : null;
  const L = (x: number) => formatLength(x, units, { feet: false });

  const connected = () => {
    const adj = new Map<string, Set<string>>();
    for (const c of analysis.connectors) {
      const m = [...(c.throughPipeId ? [c.throughPipeId] : []), ...c.arms.map((a) => a.pipeId)];
      for (const x of m) for (const y of m) if (x !== y) (adj.get(x) ?? adj.set(x, new Set()).get(x)!).add(y);
    }
    const seen = new Set(ids);
    const queue = [...ids];
    while (queue.length) for (const n of adj.get(queue.pop()!) ?? []) if (!seen.has(n)) (seen.add(n), queue.push(n));
    select([...seen]);
  };

  return (
    <div className="panel-body">
      <div className="section">
        <div className="section-head">
          <h2>{single ? 'Pipe' : `${pipes.length} pipes`}</h2>
          <div className="chips">
            {marks.map((m) => (
              <span key={m} className="part-mark sel">
                {m}
              </span>
            ))}
          </div>
        </div>
        {single && info && part && (
          <p className="note">
            {EMT[single.size].label}, {axisLabel(single.a, single.b)}. Cut to <b className="mono">{L(part.length)}</b> (part{' '}
            {part.mark}, {part.pipeIds.length} {part.pipeIds.length === 1 ? 'piece' : 'pieces'}).
          </p>
        )}
      </div>

      <div className="section">
        <div className="field">
          <span>Size</span>
          <span className="seg" role="group" aria-label="Pipe size">
            {PIPE_SIZES.map((s) => (
              <button key={s} aria-pressed={sizes.size === 1 && sizes.has(s)} onClick={() => updatePipes(ids, { size: s })}>
                {s}"
              </button>
            ))}
          </span>
        </div>
        {single && (
          <div className="field">
            <label htmlFor="pipe-length">Length</label>
            <LengthField pipe={single} />
          </div>
        )}
        {single && <p className="note">Length is centre to centre, measured from end A. The cut length above allows for the connectors.</p>}
      </div>

      {single && info && (
        <div className="section">
          <h3>Ends</h3>
          {(['a', 'b'] as const).map((e) => {
            const end = info.ends[e];
            return (
              <div className="field" key={e}>
                <label htmlFor={`end-${e}`}>End {e.toUpperCase()}</label>
                {end.hold === 'free' ? (
                  <select
                    id={`end-${e}`}
                    value={endFittingOf(single, e, design)}
                    onChange={(ev) => updatePipes([single.id], e === 'a' ? { endA: ev.target.value as Pipe['endA'] } : { endB: ev.target.value as Pipe['endB'] })}
                  >
                    {END_FITTINGS.map((f) => (
                      <option key={f} value={f}>
                        {END_LABEL[f]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="small">{endText(end, analysis, units, single.size)}</span>
                )}
              </div>
            );
          })}
          {info.marks.filter((m) => !m.atEnd).length > 0 && (
            <p className="note">
              Connector marks from end A:{' '}
              <span className="mono">
                {info.marks
                  .filter((m) => !m.atEnd)
                  .map((m) => L(m.fromA))
                  .join(', ')}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="section">
        <div className="row">
          <button className="btn" onClick={() => duplicate(ids)} title="Ctrl+D">
            <Icon.copy /> Duplicate
          </button>
          {single && (
            <button className="btn" onClick={() => splitPipe(single.id)}>
              <Icon.split /> Split in two
            </button>
          )}
          <button className="btn" onClick={connected}>
            <Icon.select_all /> Select connected
          </button>
          <button
            className="btn"
            onClick={() => {
              const pts: V3[] = [];
              for (const id of ids) {
                const i = analysis.pipes[id];
                if (i) pts.push(i.physA, i.physB);
              }
              frame(pts);
            }}
          >
            <Icon.fit /> Zoom to
          </button>
          <button className="btn danger" onClick={() => deletePipes(ids)} title="Delete">
            <Icon.trash /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function JointInspector({ jointKey }: { jointKey: string }) {
  const { design, analysis, plan } = useDerived();
  const { setJointOverride, select } = useStore.getState();
  const j = analysis.jointsByKey[jointKey];
  const override = design.joints[jointKey];
  const conns = j.connectorIds.map((id) => analysis.connectorsById[id]);
  const issues = analysis.issues.filter((i) => i.jointKey === jointKey);
  const single = conns.some((c) => c.arms.length === 1 && c.kind !== 'coupling');
  const mark = (id: string) => plan.partByPipe[id]?.mark ?? '?';

  return (
    <div className="panel-body">
      <div className="section">
        <div className="section-head">
          <h2>Joint</h2>
          <span className="chip neutral">
            {j.members.length} {j.members.length === 1 ? 'pipe' : 'pipes'}
          </span>
        </div>
        <div className="lines">
          {conns.map((c) => {
            const p = CATALOG_FOR_KIND[c.kind];
            return (
              <div className="line" key={c.id}>
                <Glyph id={p.id} />
                <div>
                  <div className="line-name">{p.name}</div>
                  <div className="line-sub">
                    {c.size}" EMT
                    {c.shims.length > 0 && <span>· {c.shims.length} adapter shim{c.shims.length > 1 ? 's' : ''}</span>}
                    {c.promoted && <span>· pipe {mark(c.throughPipeId!)} runs through</span>}
                  </div>
                </div>
                <a className="btn small ghost" href={p.url} target="_blank" rel="noreferrer">
                  Store <Icon.external />
                </a>
              </div>
            );
          })}
        </div>
      </div>
      {issues.length > 0 && <IssueList issues={issues} analysis={analysis} />}
      <div className="section">
        <h3>Pipes here</h3>
        <div className="chips">
          {j.members.map((m) => (
            <button key={m.pipeId} className="part-chip" onClick={() => select([m.pipeId])}>
              <span className="part-mark">{mark(m.pipeId)}</span>
              {m.pipeId === j.throughPipeId ? 'runs through' : m.role === 'through' ? 'runs through' : 'ends here'}
            </button>
          ))}
        </div>
      </div>
      {j.throughCandidates.length > 1 && (
        <div className="section">
          <div className="field">
            <label htmlFor="through-pipe">Runs through</label>
            <select
              id="through-pipe"
              value={j.throughPipeId}
              onChange={(e) => setJointOverride(jointKey, { throughPipeId: e.target.value })}
            >
              {j.throughCandidates.map((id) => (
                <option key={id} value={id}>
                  Pipe {mark(id)} ({axisLabel(design.pipes.find((p) => p.id === id)!.a, design.pipes.find((p) => p.id === id)!.b)})
                </option>
              ))}
            </select>
          </div>
          <p className="note">At a corner one pipe passes through the connector and is cut a little longer. Pick which one.</p>
        </div>
      )}
      {single && (
        <label className="check" htmlFor="prefer-adjustable">
          <input
            id="prefer-adjustable"
            type="checkbox"
            checked={!!override?.preferAdjustable}
            onChange={(e) => setJointOverride(jointKey, { preferAdjustable: e.target.checked })}
          />
          Use the Adjustable Angle Hinge Connector here (for a hinge or a tunable angle)
        </label>
      )}
    </div>
  );
}

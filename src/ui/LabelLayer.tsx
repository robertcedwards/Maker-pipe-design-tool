import { useEffect } from 'react';
import { visibleAt } from '../model/instructions';
import { formatShort } from '../model/units';
import type { V3 } from '../model/vec';
import { useDerived } from '../state/derived';
import { useStore } from '../state/store';
import { labelAnchors, labelElements } from '../three/labels';

/** Part letters over each pipe (and lengths for selected pipes and build steps). */
export function LabelLayer() {
  const { design, analysis, plan, steps } = useDerived();
  const showLabels = useStore((s) => s.showLabels);
  const selection = useStore((s) => s.selection);
  const tab = useStore((s) => s.tab);
  const stepIndex = useStore((s) => s.step);
  const units = useStore((s) => s.units);
  const building = tab === 'build' && steps.length > 0;
  const current = building ? steps[Math.min(stepIndex, steps.length - 1)] : null;
  const vis = building ? visibleAt(steps, Math.min(stepIndex, steps.length - 1)) : null;
  const selected = new Set(selection);

  const labels =
    showLabels && design.pipes.length <= 250
      ? design.pipes.flatMap((p) => {
          const info = analysis.pipes[p.id];
          const part = plan.partByPipe[p.id];
          if (!info || !part) return [];
          if (vis && !vis.all && !current?.pipeIds.includes(p.id)) return [];
          const mid: V3 = [
            (info.physA[0] + info.physB[0]) / 2,
            (info.physA[1] + info.physB[1]) / 2,
            (info.physA[2] + info.physB[2]) / 2,
          ];
          const long = selected.has(p.id) || (building && !vis?.all);
          return [{ id: p.id, mid, mark: part.mark, length: long ? formatShort(part.length, units) : null, sel: selected.has(p.id) || (building && !vis?.all) }];
        })
      : [];

  // Keep anchors in sync with what is rendered.
  useEffect(() => {
    labelAnchors.clear();
    for (const l of labels) labelAnchors.set(l.id, l.mid);
  });

  return (
    <div className="label-layer" aria-hidden="true">
      {labels.map((l) => (
        <div
          key={l.id}
          className={`pipe-label${l.sel ? ' is-selected' : ''}`}
          ref={(el) => {
            if (el) {
              labelElements.set(l.id, el);
              el.style.visibility = 'hidden';
            } else labelElements.delete(l.id);
          }}
        >
          <b>{l.mark}</b>
          {l.length && <span>{l.length}</span>}
        </div>
      ))}
    </div>
  );
}

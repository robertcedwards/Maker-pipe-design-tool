// Assembly instructions generated from the analysed design.
//
// Order of work: gather tools, cut and label the pipe, mark connector
// positions, then assemble. Assembly starts from the lowest horizontal frame
// and grows outward through the connectors: each step adds the lowest group
// of pipes that attaches to what is already built (a whole horizontal frame at
// one height, a set of posts, or the angled pipes once both of their ends have
// something to connect to).

import { CATALOG_FOR_KIND, HARDWARE } from '../catalog/catalog';
import { EMT, overhang } from '../catalog/emt';
import type { Analysis, PipeInfo, PlacedConnector } from './analyze';
import type { CutPlan, Part } from './cutlist';
import type { ConnectorKind, PipeSize } from './types';
import { type UnitSystem, formatLength } from './units';

export type StepKind = 'tools' | 'cut' | 'mark' | 'assemble' | 'tighten' | 'finish';

export interface StepPart {
  mark: string;
  count: number;
  length: number;
  size: PipeSize;
}

export interface StepConnector {
  kind: ConnectorKind;
  size: PipeSize;
  count: number;
  name: string;
}

export interface BuildStep {
  id: string;
  kind: StepKind;
  title: string;
  lines: string[];
  parts: StepPart[];
  connectors: StepConnector[];
  /** Pipes, connectors and fittings added in this step. */
  pipeIds: string[];
  connectorIds: string[];
  fittingIds: string[];
}

type Cls = 'h' | 'v' | 's';

const clsOf = (info: PipeInfo): Cls => {
  const y = Math.abs(info.axis[1]);
  return y < 0.02 ? 'h' : y > 0.98 ? 'v' : 's';
};
const CLS_ORDER: Record<Cls, number> = { h: 0, v: 1, s: 2 };

/** Height of a pipe's centreline for ordering: its level for horizontals, its lower end otherwise. */
const heightOf = (info: PipeInfo) => {
  const ya = info.physA[1] + info.axis[1] * info.ends.a.adjust;
  const yb = info.physB[1] - info.axis[1] * info.ends.b.adjust;
  return Math.round(Math.min(ya, yb) * 16) / 16;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function membersOf(c: PlacedConnector): string[] {
  return [...(c.throughPipeId ? [c.throughPipeId] : []), ...c.arms.map((a) => a.pipeId)];
}

function summariseParts(ids: string[], plan: CutPlan): StepPart[] {
  const m = new Map<string, StepPart>();
  for (const id of ids) {
    const part = plan.partByPipe[id];
    if (!part) continue;
    const cur = m.get(part.mark);
    if (cur) cur.count++;
    else m.set(part.mark, { mark: part.mark, count: 1, length: part.length, size: part.size });
  }
  return [...m.values()].sort((a, b) => a.mark.localeCompare(b.mark, 'en', { numeric: true }));
}

function summariseConnectors(list: PlacedConnector[]): StepConnector[] {
  const m = new Map<string, StepConnector>();
  for (const c of list) {
    const key = `${c.kind}|${c.size}`;
    const cur = m.get(key);
    if (cur) cur.count++;
    else m.set(key, { kind: c.kind, size: c.size, count: 1, name: CATALOG_FOR_KIND[c.kind].name });
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const partsText = (parts: StepPart[], units: UnitSystem) =>
  parts.map((p) => `${p.count} × ${p.mark} (${formatLength(p.length, units, { feet: false })})`).join(', ');

const connectorsText = (cs: StepConnector[]) => cs.map((c) => `${c.count} × ${c.name} (${c.size}")`).join(', ');

/** How-to line for each connector kind, used the first time that kind appears. */
const HOW_TO: Record<ConnectorKind, string> = {
  t: 'T Connector: close the two halves around the through pipe, slide the other pipe end into the sleeve until it touches the through pipe, and fit the bolt.',
  '90': '90 Degree Connector: the pipe that runs through takes the clamp; the two pipe ends meeting at the corner go into the two sleeves at right angles.',
  '180': '180 Degree Connector: clamp it on the through pipe and push the two pipe ends in from opposite sides.',
  '135': '135 Degree Connector: clamp it on the through pipe; the two pipe ends sit 135° apart around it.',
  '4way': '4 Way Connector: clamp the three pieces around the through pipe, then push in the three pipe ends.',
  '5way': '5 Way Connector: assemble the four pieces around the through pipe in a plus, then push in the four pipe ends.',
  '45': '45 Degree Connector: interlock the two halves on the through pipe with the sleeve leaning toward the brace, then slide the brace end in.',
  adjustable: 'Adjustable Angle Connector: the small pieces clamp the through pipe, the long pieces grip the pipe end. Set the angle, then snug the pivot bolt.',
  'adjustable-180': 'Adjustable 180 Degree Connector: the centre pieces clamp the through pipe; each end clamp pivots to its pipe. Set both angles before tightening.',
  coupling: 'Structural Coupling: butt the two pipe ends together at the middle of the coupling and clamp both halves over the joint.',
};

export interface InstructionOptions {
  units: UnitSystem;
}

export function buildInstructions(analysis: Analysis, plan: CutPlan, opts: InstructionOptions): BuildStep[] {
  const { units } = opts;
  // Tape-measure style: inches (or mm) without feet, which is how cut lists are read.
  const L = (x: number) => formatLength(x, units, { feet: false });
  const infos = analysis.pipes;
  const ids = Object.keys(infos);
  const steps: BuildStep[] = [];
  if (!ids.length) return steps;

  const connectors = analysis.connectors;
  const allSizes = [...new Set(Object.values(infos).map((i) => i.size))];
  const fittingKinds = new Set(analysis.fittings.map((f) => f.kind));

  // ---- 1. Tools ----
  const toolLines = [
    `${HARDWARE.tool} for the connector bolts (${HARDWARE.bolt}).`,
    'Tube cutter with a reamer, or a hacksaw and a file, to cut and deburr the EMT.',
    'Tape measure, fine marker and masking tape for labelling parts.',
  ];
  if (fittingKinds.has('cap') || fittingKinds.has('caster')) toolLines.push('Rubber mallet for end caps and caster inserts.');
  if (fittingKinds.has('flange') || fittingKinds.has('angle-flange')) toolLines.push('Drill/driver and screws to mount the flanges.');
  toolLines.push('Safety glasses and gloves: fresh-cut conduit edges are sharp.');
  steps.push({
    id: 'tools',
    kind: 'tools',
    title: 'Gather tools and parts',
    lines: toolLines,
    parts: [],
    connectors: summariseConnectors(connectors),
    pipeIds: [],
    connectorIds: [],
    fittingIds: [],
  });

  // ---- 2. Cut ----
  const sticks = allSizes
    .map((s) => (plan.sticksBySize[s] ? `${plan.sticksBySize[s]} × ${EMT[s].label}` : ''))
    .filter(Boolean)
    .join(' and ');
  steps.push({
    id: 'cut',
    kind: 'cut',
    title: 'Cut and label the pipe',
    lines: [
      `Cut ${plural(ids.length, 'piece')} from ${sticks} 10 ft sticks. The Cut list tab shows which pieces come from which stick.`,
      'Measure from a square end, mark all the way around, cut, then ream the inside burr.',
      'Write each piece’s letter on a strip of masking tape near one end.',
      'Lengths already allow for how far each pipe goes into its connectors.',
    ],
    parts: plan.parts.map((p) => ({ mark: p.mark, count: p.pipeIds.length, length: p.length, size: p.size })),
    connectors: [],
    pipeIds: [],
    connectorIds: [],
    fittingIds: [],
  });

  // ---- 3. Mark ----
  const marked = plan.parts.filter((p) => p.marks.length);
  if (marked.length) {
    steps.push({
      id: 'mark',
      kind: 'mark',
      title: 'Mark connector positions',
      lines: [
        ...marked.map(
          (p: Part) =>
            `${p.mark} (${plural(p.pipeIds.length, 'piece')}): mark at ${p.marks.map((m) => L(m)).join(', ')} from one end.`,
        ),
        'Marks are connector centres. Measure every piece of a part from the same end and keep that end pointing the same way.',
      ],
      parts: marked.map((p) => ({ mark: p.mark, count: p.pipeIds.length, length: p.length, size: p.size })),
      connectors: [],
      pipeIds: [],
      connectorIds: [],
      fittingIds: [],
    });
  }

  // ---- 4. Assemble ----
  const adj = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
  const connectorsOf = new Map<string, PlacedConnector[]>(ids.map((id) => [id, []]));
  for (const c of connectors) {
    const m = membersOf(c);
    for (const x of m) {
      connectorsOf.get(x)?.push(c);
      for (const y of m) if (x !== y) adj.get(x)?.add(y);
    }
  }
  const key = (id: string) => ({ h: heightOf(infos[id]), c: clsOf(infos[id]) });
  const sameKey = (a: string, b: string) => {
    const ka = key(a);
    const kb = key(b);
    return ka.h === kb.h && ka.c === kb.c;
  };
  const cmpKey = (a: string, b: string) => {
    const ka = key(a);
    const kb = key(b);
    return ka.h - kb.h || CLS_ORDER[ka.c] - CLS_ORDER[kb.c];
  };
  const position = (id: string) => {
    const i = infos[id];
    return Math.min(i.physA[0], i.physB[0]) * 1e4 + Math.min(i.physA[2], i.physB[2]);
  };

  /** Whether the pipes form one piece through connectors among themselves. */
  const connected = (group: string[]) => {
    const inside = new Set(group);
    const seen = new Set([group[0]]);
    const queue = [group[0]];
    while (queue.length) {
      for (const n of adj.get(queue.pop()!)!) {
        if (inside.has(n) && !seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    return seen.size === group.length;
  };

  const pending = new Set(ids);
  const placed = new Set<string>();
  const introduced = new Set<string>();
  const hHeights = ids.filter((id) => clsOf(infos[id]) === 'h').map((id) => heightOf(infos[id]));
  const minH = Math.min(...hHeights);
  const maxH = Math.max(...hHeights);
  const seenKinds = new Set<ConnectorKind>();
  let frameCount = 0;

  while (pending.size) {
    const touching = [...pending].filter((id) => [...adj.get(id)!].some((n) => placed.has(n)));
    let group: string[];
    if (!touching.length) {
      // Start (or restart, for a separate structure) from the lowest horizontal pipes.
      const flat = [...pending].filter((id) => clsOf(infos[id]) === 'h');
      const pool = (flat.length ? flat : [...pending]).sort((a, b) => cmpKey(a, b) || position(a) - position(b));
      group = pool.filter((id) => sameKey(id, pool[0]));
    } else {
      const eligible = touching.filter((id) => clsOf(infos[id]) !== 's' || [...adj.get(id)!].every((n) => placed.has(n)));
      const pool = (eligible.length ? eligible : touching).sort((a, b) => cmpKey(a, b) || position(a) - position(b));
      group = pool.filter((id) => sameKey(id, pool[0]));
    }
    // A horizontal frame is built in one go: pull in its connected pipes at the same height.
    if (clsOf(infos[group[0]]) === 'h') {
      const seen = new Set(group);
      const queue = [...group];
      while (queue.length) {
        const cur = queue.pop()!;
        for (const n of adj.get(cur)!) {
          if (!pending.has(n) || seen.has(n) || !sameKey(n, cur)) continue;
          seen.add(n);
          queue.push(n);
        }
      }
      group = [...seen];
    }
    group.sort((a, b) => position(a) - position(b));
    const inGroup = new Set(group);

    // Connectors this step touches, new or already on the frame.
    const touched = new Map<string, PlacedConnector>();
    for (const id of group) for (const c of connectorsOf.get(id)!) touched.set(c.id, c);
    const fresh: PlacedConnector[] = [];
    const existing: PlacedConnector[] = [];
    for (const c of touched.values()) {
      if (introduced.has(c.id)) existing.push(c);
      else if (membersOf(c).filter((m) => inGroup.has(m) || placed.has(m)).length >= 2) fresh.push(c);
    }
    for (const c of fresh) introduced.add(c.id);

    const cls = clsOf(infos[group[0]]);
    const h = heightOf(infos[group[0]]);
    let title: string;
    const firstMark = plan.partByPipe[group[0]]?.mark ?? '';
    if (cls === 'h') {
      if (group.length === 1) title = `Add rail ${firstMark} at ${L(h)}`;
      else if (!connected(group)) title = h === minH ? `Lay out ${group.length} rails` : `Add ${group.length} rails at ${L(h)}`;
      else {
        frameCount++;
        if (h === minH && frameCount === 1) title = 'Build the bottom frame';
        else if (h === maxH && h !== minH) title = 'Build the top frame';
        else title = `Build the frame at ${L(h)}`;
      }
    } else if (cls === 'v') {
      title = group.length === 1 ? `Add post ${firstMark}` : `Add ${group.length} posts`;
    } else {
      const all45 = group.every((id) => connectorsOf.get(id)!.every((c) => c.kind === '45'));
      title = all45 ? `Add the 45° ${group.length === 1 ? 'brace' : 'braces'}` : `Add the angled ${group.length === 1 ? 'pipe' : 'pipes'}`;
    }

    const parts = summariseParts(group, plan);
    const cs = summariseConnectors(fresh);
    const lines: string[] = [`Parts: ${partsText(parts, units)}.`];
    if (cs.length) lines.push(`Connectors: ${connectorsText(cs)}.`);
    for (const c of fresh) {
      if (seenKinds.has(c.kind)) continue;
      seenKinds.add(c.kind);
      lines.push(HOW_TO[c.kind]);
    }
    const promotedMarks = new Set<string>();
    for (const c of fresh) {
      if (c.promoted && c.throughPipeId) {
        const part = plan.partByPipe[c.throughPipeId];
        if (part) promotedMarks.add(part.mark);
      }
    }
    if (promotedMarks.size) {
      const sz = infos[group[0]].size;
      lines.push(
        `At the corners, ${[...promotedMarks].sort().join(' and ')} runs through the connector and sticks out about ${L(overhang(sz))} past it. That extra is already in its cut length.`,
      );
    }
    const feedThrough = [...new Set(existing.filter((c) => c.throughPipeId && inGroup.has(c.throughPipeId)).map((c) => plan.partByPipe[c.throughPipeId!]?.mark))];
    if (feedThrough.length) lines.push(`Feed ${feedThrough.sort().join(' and ')} through the clamps already on the frame. Loosen those bolts a turn if it is tight.`);
    const intoExisting = existing.some((c) => c.arms.some((a) => inGroup.has(a.pipeId)));
    if (intoExisting) lines.push('Push the pipe ends into the sleeves of the connectors already on the frame.');
    const withMarks = [...new Set(group.filter((id) => plan.partByPipe[id]?.marks.length).map((id) => plan.partByPipe[id].mark))];
    if (withMarks.length) lines.push(`Line the connector centres up with the marks on ${withMarks.sort().join(', ')}.`);
    lines.push('Keep the bolts snug, not tight, until the whole frame is together.');

    steps.push({
      id: `asm-${steps.length}`,
      kind: 'assemble',
      title,
      lines,
      parts,
      connectors: cs,
      pipeIds: group,
      connectorIds: fresh.map((c) => c.id),
      fittingIds: [],
    });
    for (const id of group) {
      pending.delete(id);
      placed.add(id);
    }
  }
  // Any connector not yet introduced (e.g. on a lone pipe) goes with the last assembly step.
  const leftovers = connectors.filter((c) => !introduced.has(c.id));
  if (leftovers.length) {
    const last = [...steps].reverse().find((s) => s.kind === 'assemble');
    if (last) last.connectorIds.push(...leftovers.map((c) => c.id));
  }

  // ---- 5. Square and tighten ----
  const bolts = connectors.reduce((s, c) => s + (CATALOG_FOR_KIND[c.kind].bolts ?? 0), 0);
  steps.push({
    id: 'tighten',
    kind: 'tighten',
    title: 'Square up and tighten',
    lines: [
      'Stand the frame on a flat floor. Measure both diagonals of each rectangle and nudge the frame until they match.',
      `Tighten all ${plural(bolts, 'bolt')} with the ${HARDWARE.tool.split(' (')[0]} to about ${HARDWARE.torque}. A small gap between connector halves is normal.`,
      'Recheck the diagonals, then give every bolt a final snug.',
    ],
    parts: [],
    connectors: [],
    pipeIds: [],
    connectorIds: [],
    fittingIds: [],
  });

  // ---- 6. Finish ----
  const fittings = analysis.fittings;
  if (fittings.length) {
    const count = (k: string) => fittings.filter((f) => f.kind === k).length;
    const lines: string[] = [];
    if (count('cap')) lines.push(`Tap ${plural(count('cap'), 'end cap')} into the open pipe ends until flush.`);
    if (count('foot')) lines.push(`Push ${plural(count('foot'), 'rubber foot', 'rubber feet')} onto the pipe ends.`);
    if (count('caster')) lines.push(`Tap ${plural(count('caster'), 'caster insert')} into the leg ends with a rubber mallet, then fit the casters.`);
    if (count('flange')) lines.push(`Set the frame in place and screw ${plural(count('flange'), 'flange')} to the surface.`);
    if (count('angle-flange')) lines.push(`Set the angle on ${plural(count('angle-flange'), 'Adjustable Angle Flange')}, tighten, and screw the bases down.`);
    steps.push({
      id: 'finish',
      kind: 'finish',
      title: 'Fit the ends',
      lines,
      parts: [],
      connectors: [],
      pipeIds: [],
      connectorIds: [],
      fittingIds: fittings.map((f) => f.id),
    });
  }
  return steps;
}

/** Ids visible at a given step: everything placed up to and including it. */
export function visibleAt(steps: BuildStep[], index: number): { pipes: Set<string>; connectors: Set<string>; fittings: Set<string>; all: boolean } {
  const step = steps[index];
  const all = !step || step.kind === 'tools' || step.kind === 'cut' || step.kind === 'mark' || step.kind === 'tighten' || step.kind === 'finish';
  const pipes = new Set<string>();
  const connectors = new Set<string>();
  const fittings = new Set<string>();
  for (let i = 0; i <= index && i < steps.length; i++) {
    for (const id of steps[i].pipeIds) pipes.add(id);
    for (const id of steps[i].connectorIds) connectors.add(id);
    for (const id of steps[i].fittingIds) fittings.add(id);
  }
  return { pipes, connectors, fittings, all };
}

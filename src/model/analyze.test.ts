import { describe, expect, it } from 'vitest';
import { analyze } from './analyze';
import { TEMPLATES, designFromTemplate, templateDefaults } from './templates';
import type { Design, Pipe } from './types';
import type { V3 } from './vec';
import { overhang, radius } from '../catalog/emt';

const pipe = (id: string, a: V3, b: V3, extra: Partial<Pipe> = {}): Pipe => ({ id, a, b, size: '3/4', ...extra });
const design = (pipes: Pipe[], extra: Partial<Design> = {}): Design => ({
  version: 1,
  name: 't',
  pipes,
  joints: {},
  defaultEnd: 'cap',
  ...extra,
});
const kinds = (d: Design) => {
  const out: Record<string, number> = {};
  for (const c of analyze(d).connectors) out[c.kind] = (out[c.kind] ?? 0) + 1;
  return out;
};
const tpl = (id: string, over: Record<string, number> = {}) => {
  const t = TEMPLATES.find((x) => x.id === id)!;
  return designFromTemplate(t, { ...templateDefaults(t), ...over }, '3/4');
};
const R = radius('3/4') + 0.02;

describe('single joints', () => {
  it('a pipe ending on another pipe makes a T connector', () => {
    const a = analyze(design([pipe('run', [0, 0, 0], [24, 0, 0]), pipe('leg', [12, 0, 0], [12, 12, 0])]));
    expect(a.connectors).toHaveLength(1);
    const c = a.connectors[0];
    expect(c.kind).toBe('t');
    expect(c.throughPipeId).toBe('run');
    expect(c.promoted).toBe(false);
    expect(a.pipes.leg.cutLength).toBeCloseTo(12 - R, 6);
    expect(a.pipes.run.cutLength).toBeCloseTo(24, 6);
    expect(a.pipes.run.marks.map((m) => m.fromA)).toEqual([12]);
    expect(a.issues).toEqual([]);
  });

  it('two opposite pipe ends on a through pipe make a 180 Degree Connector', () => {
    const d = design([
      pipe('run', [0, 0, 0], [0, 24, 0]),
      pipe('l', [0, 12, 0], [-10, 12, 0]),
      pipe('r', [0, 12, 0], [10, 12, 0]),
    ]);
    expect(kinds(d)).toEqual({ '180': 1 });
  });

  it('two perpendicular pipe ends on a through pipe make a 90 Degree Connector', () => {
    const d = design([
      pipe('post', [0, 0, 0], [0, 24, 0]),
      pipe('x', [0, 12, 0], [10, 12, 0]),
      pipe('z', [0, 12, 0], [0, 12, 10]),
    ]);
    expect(kinds(d)).toEqual({ '90': 1 });
  });

  it('a 45 degree brace uses 45 Degree Connectors, other angles the Adjustable Angle Connector', () => {
    const brace = design([
      pipe('post', [0, 0, 0], [0, 30, 0]),
      pipe('rail', [0, 30, 0], [30, 30, 0]),
      pipe('brace', [0, 20, 0], [10, 30, 0]),
    ]);
    const k = kinds(brace);
    expect(k['45']).toBe(2);

    const shallow = design([pipe('run', [0, 0, 0], [40, 0, 0]), pipe('arm', [10, 0, 0], [30, 11.547, 0])]);
    expect(kinds(shallow)).toEqual({ adjustable: 1 });
  });

  it('135 Degree, 4 Way and 5 Way patterns around a through pipe', () => {
    const d = 10 / Math.SQRT2;
    const oct = design([
      pipe('run', [0, 0, 0], [0, 30, 0]),
      pipe('a', [0, 15, 0], [10, 15, 0]),
      pipe('b', [0, 15, 0], [-d, 15, d]),
    ]);
    expect(kinds(oct)).toEqual({ '135': 1 });
    const four = design([
      pipe('run', [0, 0, 0], [0, 30, 0]),
      pipe('x1', [0, 15, 0], [10, 15, 0]),
      pipe('x2', [0, 15, 0], [-10, 15, 0]),
      pipe('z', [0, 15, 0], [0, 15, 10]),
    ]);
    expect(kinds(four)).toEqual({ '4way': 1 });
    const five = design([
      pipe('run', [0, 0, 0], [0, 30, 0]),
      pipe('x1', [0, 15, 0], [10, 15, 0]),
      pipe('x2', [0, 15, 0], [-10, 15, 0]),
      pipe('z1', [0, 15, 0], [0, 15, 10]),
      pipe('z2', [0, 15, 0], [0, 15, -10]),
    ]);
    expect(kinds(five)).toEqual({ '5way': 1 });
    expect(analyze(five).issues).toEqual([]);
  });

  it('two tilted pipes on opposite sides of a through pipe share an Adjustable 180', () => {
    const d = design([
      pipe('post', [0, 0, 0], [0, 40, 0]),
      pipe('l', [0, 30, 0], [-10, 20, 0]),
      pipe('r', [0, 30, 0], [10, 20, 0]),
    ]);
    expect(kinds(d)).toEqual({ 'adjustable-180': 1 });
  });

  it('a smaller pipe gets an adapter shim in the larger connector', () => {
    const a = analyze(design([pipe('run', [0, 0, 0], [24, 0, 0]), pipe('leg', [12, 0, 0], [12, 12, 0], { size: '1/2' })]));
    expect(a.connectors[0].size).toBe('3/4');
    expect(a.connectors[0].shims).toEqual([{ pipeId: 'leg', kind: '3/4-1/2' }]);
    expect(a.issues).toEqual([]);
    const bad = analyze(design([pipe('run', [0, 0, 0], [24, 0, 0], { size: '1' }), pipe('leg', [12, 0, 0], [12, 12, 0], { size: '1/2' })]));
    expect(bad.issues.some((i) => i.message.includes('shim'))).toBe(true);
  });

  it('prefers the adjustable connector when the joint asks for it', () => {
    const d = design([pipe('run', [0, 0, 0], [24, 0, 0]), pipe('leg', [12, 0, 0], [12, 12, 0])]);
    const key = analyze(d).connectors[0].jointKey;
    d.joints[key] = { preferAdjustable: true };
    expect(kinds(d)).toEqual({ adjustable: 1 });
  });

  it('two pipe ends in a straight line are spliced with a coupling', () => {
    const a = analyze(design([pipe('a', [0, 0, 0], [60, 0, 0]), pipe('b', [60, 0, 0], [120, 0, 0])]));
    expect(a.connectors.map((c) => c.kind)).toEqual(['coupling']);
    expect(a.pipes.a.cutLength).toBeCloseTo(60, 6);
  });

  it('an L corner promotes one pipe to run through a T connector', () => {
    const a = analyze(design([pipe('post', [0, 0, 0], [0, 30, 0]), pipe('rail', [0, 30, 0], [20, 30, 0])]));
    expect(a.connectors).toHaveLength(1);
    const c = a.connectors[0];
    expect(c.kind).toBe('t');
    expect(c.promoted).toBe(true);
    // The post top is at the joint, so the post runs through and pokes up.
    expect(c.throughPipeId).toBe('post');
    expect(a.pipes.post.cutLength).toBeCloseTo(30 + overhang('3/4'), 6);
    expect(a.pipes.rail.cutLength).toBeCloseTo(20 - R, 6);
    expect(a.joints[0].throughCandidates.sort()).toEqual(['post', 'rail']);
  });

  it('respects a through-pipe override at an elbow', () => {
    const d = design([pipe('post', [0, 0, 0], [0, 30, 0]), pipe('rail', [0, 30, 0], [20, 30, 0])]);
    const key = analyze(d).joints[0].key;
    d.joints[key] = { throughPipeId: 'rail' };
    const a = analyze(d);
    expect(a.connectors[0].throughPipeId).toBe('rail');
    expect(a.pipes.rail.cutLength).toBeCloseTo(20 + overhang('3/4'), 6);
    expect(a.pipes.post.cutLength).toBeCloseTo(30 - R, 6);
  });

  it('free ends get the default end fitting unless the pipe overrides it', () => {
    const d = design([pipe('p', [0, 0, 0], [0, 10, 0], { endA: 'caster', endB: 'flange' })]);
    let a = analyze(d);
    expect(a.fittings.map((f) => `${f.end}:${f.kind}`).sort()).toEqual(['a:caster', 'b:flange']);
    d.pipes[0].endA = undefined;
    a = analyze(d);
    expect(a.fittings.map((f) => `${f.end}:${f.kind}`).sort()).toEqual(['a:cap', 'b:flange']);
    d.defaultEnd = 'open';
    expect(analyze(d).fittings.map((f) => f.kind)).toEqual(['flange']);
  });
});

describe('problems are reported', () => {
  it('pipes crossing without a joint', () => {
    const a = analyze(design([pipe('a', [0, 0, 0], [20, 0, 0]), pipe('b', [10, 0, -10], [10, 0, 10])]));
    expect(a.issues.some((i) => i.level === 'error' && i.pipeIds?.includes('a') && i.pipeIds.includes('b'))).toBe(true);
  });

  it('three pipe ends at 120 degrees around a through pipe need two connectors', () => {
    const c = Math.cos((2 * Math.PI) / 3) * 10;
    const s = Math.sin((2 * Math.PI) / 3) * 10;
    const a = analyze(
      design([
        pipe('run', [0, 0, 0], [0, 30, 0]),
        pipe('x1', [0, 15, 0], [10, 15, 0]),
        pipe('x2', [0, 15, 0], [c, 15, s]),
        pipe('x3', [0, 15, 0], [c, 15, -s]),
      ]),
    );
    expect(a.connectors).toHaveLength(3);
    expect(a.joints[0].compound).toBe(true);
    expect(a.issues.some((i) => i.level === 'warning')).toBe(true);
  });

  it('pipes longer than a 10 ft stick', () => {
    const a = analyze(design([pipe('long', [0, 0, 0], [130, 0, 0])]));
    expect(a.issues.some((i) => i.message.includes('10 ft'))).toBe(true);
  });

  it('connectors too close together on one pipe', () => {
    const a = analyze(
      design([pipe('run', [0, 0, 0], [30, 0, 0]), pipe('a', [10, 0, 0], [10, 10, 0]), pipe('b', [11, 0, 0], [11, 0, 10])]),
    );
    expect(a.issues.some((i) => i.message.includes('apart'))).toBe(true);
  });

  it('two pipes through one point', () => {
    const a = analyze(
      design([pipe('a', [0, 0, 0], [20, 0, 0]), pipe('b', [10, -10, 0], [10, 10, 0]), pipe('c', [10, 0, 0], [10, 0, 10])]),
    );
    expect(a.issues.some((i) => i.message.includes('pass through the same point'))).toBe(true);
  });
});

describe('templates', () => {
  it('every template analyses without errors or warnings', () => {
    for (const t of TEMPLATES) {
      const a = analyze(designFromTemplate(t, templateDefaults(t), '3/4'));
      expect(a.issues, t.id).toEqual([]);
    }
  });

  it('cube: eight 90 Degree corners, two lengths of rail', () => {
    const d = tpl('cube', { s: 24 });
    expect(kinds(d)).toEqual({ '90': 8 });
    const a = analyze(d);
    const lengths = new Set(Object.values(a.pipes).map((p) => p.cutLength.toFixed(3)));
    // Posts: through at the top, arm at the bottom. Bottom X rails run through,
    // bottom Z rails end in arms. Top rails are all arms.
    expect(lengths.size).toBeLessThanOrEqual(3);
    expect(a.fittings).toHaveLength(0);
  });

  it('shelf unit: corners, shelf supports and capped feet', () => {
    const d = tpl('shelf', { w: 36, d: 18, h: 60, n: 3 });
    expect(kinds(d)).toEqual({ '90': 12, t: 6 });
    const a = analyze(d);
    expect(a.fittings.filter((f) => f.kind === 'cap')).toHaveLength(4);
    const posts = Object.values(a.pipes).filter((p) => Math.abs(p.axis[1]) > 0.99);
    expect(posts).toHaveLength(4);
    for (const p of posts) expect(p.cutLength).toBeCloseTo(60 + overhang('3/4'), 6);
  });

  it('workbench: eight 45 Degree Connectors for the knee braces', () => {
    expect(kinds(tpl('bench'))['45']).toBe(8);
  });

  it('garment rack: T connectors only, four capped feet', () => {
    const d = tpl('rack');
    expect(kinds(d)).toEqual({ t: 6 });
    expect(analyze(d).fittings).toHaveLength(4);
  });

  it('greenhouse: rafter pairs meet the ridge in 90 Degree Connectors', () => {
    const d = tpl('greenhouse', { n: 3 });
    expect(kinds(d)).toEqual({ '90': 7, t: 14 });
  });
});

describe('template robustness', () => {
  it('fills in missing and out-of-range template values', () => {
    const t = TEMPLATES.find((x) => x.id === 'shelf')!;
    const d = designFromTemplate(t, { w: Number.NaN, h: 1000 }, '3/4');
    for (const p of d.pipes) for (const c of [...p.a, ...p.b]) expect(Number.isFinite(c)).toBe(true);
    expect(Math.max(...d.pipes.map((p) => Math.max(p.a[1], p.b[1])))).toBe(96);
  });
});

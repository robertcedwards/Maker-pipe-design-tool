import { describe, expect, it } from 'vitest';
import { analyze } from './analyze';
import { buildCutPlan, markFor, roundCut } from './cutlist';
import { TEMPLATES, designFromTemplate, templateDefaults } from './templates';
import type { Design, Pipe } from './types';

const design = (pipes: Pipe[]): Design => ({ version: 1, name: 't', pipes, joints: {}, defaultEnd: 'open' });
const free = (id: string, len: number, size: Pipe['size'] = '3/4'): Pipe => ({
  id,
  a: [0, 0, Number(id.replace(/\D/g, '')) * 10],
  b: [len, 0, Number(id.replace(/\D/g, '')) * 10],
  size,
});

describe('cut plan', () => {
  it('letters parts A..Z then AA', () => {
    expect(markFor(0)).toBe('A');
    expect(markFor(25)).toBe('Z');
    expect(markFor(26)).toBe('AA');
    expect(markFor(27)).toBe('AB');
  });

  it('rounds to 1/16 in', () => {
    expect(roundCut(23.038)).toBe(23.0625);
    expect(roundCut(11.86)).toBe(11.875);
  });

  it('groups equal lengths into one part, longest first', () => {
    const plan = buildCutPlan(analyze(design([free('p1', 30), free('p2', 60), free('p3', 30)])));
    expect(plan.parts.map((p) => [p.mark, p.length, p.pipeIds.length])).toEqual([
      ['A', 60, 1],
      ['B', 30, 2],
    ]);
  });

  it('packs cuts into 10 ft sticks with kerf', () => {
    // Two 59.9 in cuts plus kerf fit one stick; two 60 in cuts plus kerf do not.
    const plan = buildCutPlan(analyze(design([free('p1', 59.9), free('p2', 59.9), free('p3', 59.9), free('p4', 59.9)])), { kerf: 0.125 });
    expect(plan.sticks).toHaveLength(2);
    const tight = buildCutPlan(analyze(design([free('p1', 60), free('p2', 60)])), { kerf: 0.125 });
    expect(tight.sticks).toHaveLength(2);
    const noKerf = buildCutPlan(analyze(design([free('p1', 60), free('p2', 60)])), { kerf: 0 });
    expect(noKerf.sticks).toHaveLength(1);
  });

  it('keeps sizes on separate sticks', () => {
    const plan = buildCutPlan(analyze(design([free('p1', 30, '3/4'), free('p2', 30, '1')])));
    expect(plan.sticksBySize).toEqual({ '3/4': 1, '1': 1 });
  });

  it('counts whole sticks for over-length pipes', () => {
    const plan = buildCutPlan(analyze(design([free('p1', 130)])));
    expect(plan.overLength).toEqual(['p1']);
    expect(plan.sticksBySize['3/4']).toBe(2);
  });

  it('a 36x18x60 shelf unit fits in a sensible number of sticks', () => {
    const t = TEMPLATES.find((x) => x.id === 'shelf')!;
    const plan = buildCutPlan(analyze(designFromTemplate(t, templateDefaults(t), '3/4')));
    const total = plan.totalLengthBySize['3/4']!;
    expect(plan.sticks.length).toBeGreaterThanOrEqual(Math.ceil(total / 120));
    expect(plan.sticks.length).toBeLessThanOrEqual(Math.ceil(total / 120) + 1);
    for (const s of plan.sticks) expect(s.used).toBeLessThanOrEqual(120);
  });
});

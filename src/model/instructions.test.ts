import { describe, expect, it } from 'vitest';
import { analyze } from './analyze';
import { buildCutPlan } from './cutlist';
import { buildInstructions, visibleAt } from './instructions';
import { TEMPLATES, designFromTemplate, templateDefaults } from './templates';

const stepsFor = (id: string) => {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const a = analyze(designFromTemplate(t, templateDefaults(t), '3/4'));
  const plan = buildCutPlan(a);
  return { a, plan, steps: buildInstructions(a, plan, { units: 'imperial' }) };
};

describe('assembly instructions', () => {
  it('shelf unit builds bottom frame, posts, middle frame, top frame', () => {
    const { steps } = stepsFor('shelf');
    expect(steps.map((s) => s.title)).toEqual([
      'Gather tools and parts',
      'Cut and label the pipe',
      'Mark connector positions',
      'Build the bottom frame',
      'Add 4 posts',
      'Build the frame at 33"',
      'Build the top frame',
      'Square up and tighten',
      'Fit the ends',
    ]);
  });

  for (const t of TEMPLATES) {
    it(`${t.id}: every pipe and connector is placed exactly once`, () => {
      const { a, steps } = stepsFor(t.id);
      const pipes = steps.flatMap((s) => s.pipeIds);
      const conns = steps.flatMap((s) => s.connectorIds);
      expect(pipes.sort()).toEqual(Object.keys(a.pipes).sort());
      expect(conns.sort()).toEqual(a.connectors.map((c) => c.id).sort());
      expect(new Set(pipes).size).toBe(pipes.length);
      // Braces come after the pipes they brace.
      const order = new Map<string, number>();
      steps.forEach((s, i) => s.pipeIds.forEach((id) => order.set(id, i)));
      for (const c of a.connectors.filter((c) => c.kind === '45')) {
        const brace = c.arms[0].pipeId;
        expect(order.get(brace)!).toBeGreaterThanOrEqual(order.get(c.throughPipeId!)!);
      }
    });
  }

  it('visibility accumulates through the assembly steps', () => {
    const { a, steps } = stepsFor('cube');
    const last = steps.findLastIndex((s) => s.kind === 'assemble');
    expect(visibleAt(steps, last).pipes.size).toBe(Object.keys(a.pipes).length);
    const first = steps.findIndex((s) => s.kind === 'assemble');
    expect(visibleAt(steps, first).pipes.size).toBe(4);
    expect(visibleAt(steps, 0).all).toBe(true);
  });

  it('mark step lists mid-pipe connector positions', () => {
    const { steps } = stepsFor('shelf');
    const mark = steps.find((s) => s.kind === 'mark')!;
    expect(mark.lines.some((l) => /mark at 6", 33"/.test(l))).toBe(true);
  });
});

describe('markdown build sheet', () => {
  it('includes the cut list, connectors and every step', async () => {
    const { buildMarkdown } = await import('./exportDoc');
    const { buildBom, DEFAULT_ORDER } = await import('./bom');
    const t = TEMPLATES.find((x) => x.id === 'shelf')!;
    const d = designFromTemplate(t, templateDefaults(t), '3/4');
    const a = analyze(d);
    const plan = buildCutPlan(a);
    const steps = buildInstructions(a, plan, { units: 'imperial' });
    const md = buildMarkdown(d, a, plan, buildBom(d, a, plan, DEFAULT_ORDER), steps, 'imperial');
    expect(md).toContain('# Shelving unit: build sheet');
    expect(md).toContain('| A | 3/4" | 61" | 4 | 6", 33" |');
    expect(md).toContain('- 12 × 90 Degree Connector (3/4")');
    expect(md.match(/^### /gm)?.length).toBe(steps.length);
  });
});

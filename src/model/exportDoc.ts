// A plain Markdown build sheet: size, parts, cut plan, connectors and steps.
// Used by "Copy instructions" and "Save instructions" on the Build tab.

import { CATALOG_FOR_KIND } from '../catalog/catalog';
import { EMT } from '../catalog/emt';
import { type Analysis, bounds } from './analyze';
import type { Bom } from './bom';
import type { CutPlan } from './cutlist';
import type { BuildStep } from './instructions';
import type { Design } from './types';
import { PIPE_SIZES } from './types';
import { type UnitSystem, formatLength, formatMoney } from './units';

export function buildMarkdown(design: Design, analysis: Analysis, plan: CutPlan, bom: Bom, steps: BuildStep[], units: UnitSystem): string {
  const L = (x: number) => formatLength(x, units, { feet: false });
  const b = bounds(analysis);
  const out: string[] = [`# ${design.name}: build sheet`, ''];
  if (b) {
    out.push(
      `Outside size ${L(b.size[0])} wide × ${L(b.size[2])} deep × ${L(b.size[1])} high. ${design.pipes.length} pipes, ${analysis.connectors.length} connectors, ${bom.bolts} bolts.`,
      '',
    );
  }

  out.push('## Cut list', '', '| Part | EMT | Cut to | Qty | Connector marks |', '|---|---|---:|---:|---|');
  for (const p of plan.parts) {
    out.push(`| ${p.mark} | ${p.size}" | ${L(p.length)} | ${p.pipeIds.length} | ${p.marks.length ? p.marks.map(L).join(', ') : ''} |`);
  }
  out.push('');
  for (const size of PIPE_SIZES) {
    const sticks = plan.sticks.filter((s) => s.size === size);
    if (!sticks.length) continue;
    out.push(`**${EMT[size].label}, ${sticks.length} × 10 ft sticks**`, '');
    sticks.forEach((s, i) => out.push(`${i + 1}. ${s.cuts.map((c) => `${c.mark} ${L(c.length)}`).join(' + ')} (offcut ${L(s.offcut)})`));
    out.push('');
  }

  const counts = new Map<string, number>();
  for (const c of analysis.connectors) {
    const key = `${CATALOG_FOR_KIND[c.kind].name} (${c.size}")`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const f of analysis.fittings) {
    const key = `${CATALOG_FOR_KIND[f.kind].name} (${f.size}")`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size) {
    out.push('## Connectors and fittings', '');
    for (const [name, n] of [...counts].sort((x, y) => y[1] - x[1])) out.push(`- ${n} × ${name}`);
    out.push('');
  }

  out.push('## Steps', '');
  steps.forEach((s, i) => {
    out.push(`### ${i + 1}. ${s.title}`, '');
    for (const line of s.lines) out.push(`- ${line}`);
    out.push('');
  });

  out.push('## Cost estimate', '');
  for (const l of bom.lines) {
    out.push(`- ${l.qty} × ${l.name}${l.size ? ` ${l.size}"` : ''}${l.pack > 1 ? ` (${l.pack}-pack)` : ''}: ${l.total === null ? 'price not listed' : formatMoney(l.total)}`);
  }
  out.push('', `Estimated total ${formatMoney(bom.total)} including ${formatMoney(bom.shipping)} shipping. Prices change; check the store.`, '');
  return out.join('\n');
}

import { analyze, type Analysis } from '../model/analyze';
import { buildBom, type Bom, type OrderOptions } from '../model/bom';
import { buildCutPlan, type CutPlan } from '../model/cutlist';
import { buildInstructions, type BuildStep } from '../model/instructions';
import type { Design } from '../model/types';
import type { UnitSystem } from '../model/units';
import { useStore } from './store';

/** Memoise on argument identity (the design and options are immutable snapshots). */
function memo<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let lastArgs: A | null = null;
  let last: R;
  return (...args: A) => {
    if (!lastArgs || args.length !== lastArgs.length || args.some((a, i) => a !== lastArgs![i])) {
      lastArgs = args;
      last = fn(...args);
    }
    return last;
  };
}

const analyzeM = memo((d: Design) => analyze(d));
const planM = memo((a: Analysis, kerf: number) => buildCutPlan(a, { kerf }));
const bomM = memo((d: Design, a: Analysis, p: CutPlan, o: OrderOptions) => buildBom(d, a, p, o));
const stepsM = memo((a: Analysis, p: CutPlan, units: UnitSystem) => buildInstructions(a, p, { units }));

export interface Derived {
  design: Design;
  analysis: Analysis;
  plan: CutPlan;
  bom: Bom;
  steps: BuildStep[];
}

export function useDerived(): Derived {
  const design = useStore((s) => s.design);
  const order = useStore((s) => s.order);
  const units = useStore((s) => s.units);
  const kerf = useStore((s) => s.kerf);
  const analysis = analyzeM(design);
  const plan = planM(analysis, kerf);
  const bom = bomM(design, analysis, plan, order);
  const steps = stepsM(analysis, plan, units);
  return { design, analysis, plan, bom, steps };
}

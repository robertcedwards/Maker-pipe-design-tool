// Cut list: groups pipes into lettered parts and packs the cuts into 10 ft EMT
// sticks with a best-fit-decreasing heuristic. A part is a set of pipes with
// the same size, the same cut length and the same connector marks along their
// length, so any piece of a part can go in any of that part's positions.

import { STICK_LENGTH } from '../catalog/emt';
import type { Analysis, PipeInfo } from './analyze';
import type { PipeSize } from './types';
import { PIPE_SIZES } from './types';

/** Cut lengths and marks are rounded to the nearest 1/16 in. */
export const roundCut = (x: number): number => Math.round(x * 16) / 16;

export interface Part {
  /** Part letter shown on labels, cut list and instructions: A, B, ... Z, AA, AB ... */
  mark: string;
  size: PipeSize;
  length: number;
  pipeIds: string[];
  /** Mid-pipe connector positions, measured from one end (the same end for every piece). */
  marks: number[];
}

export interface StickCut {
  mark: string;
  length: number;
  pipeId: string;
}

export interface Stick {
  size: PipeSize;
  cuts: StickCut[];
  used: number;
  offcut: number;
}

export interface CutPlan {
  parts: Part[];
  partByPipe: Record<string, Part>;
  sticks: Stick[];
  sticksBySize: Partial<Record<PipeSize, number>>;
  /** Pipes that cannot come from one stick. */
  overLength: string[];
  totalLengthBySize: Partial<Record<PipeSize, number>>;
}

export function markFor(i: number): string {
  let s = '';
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Mid-pipe marks read from whichever end gives the smaller sequence, so flipped twins match. */
export function canonicalMarks(info: PipeInfo, length: number): number[] {
  const fromA = info.marks.filter((m) => !m.atEnd).map((m) => roundCut(m.fromA));
  const fromB = fromA.map((m) => roundCut(length - m)).reverse();
  for (let i = 0; i < fromA.length; i++) {
    if (fromA[i] !== fromB[i]) return fromA[i] < fromB[i] ? fromA : fromB;
  }
  return fromA;
}

export function buildCutPlan(analysis: Analysis, opts: { kerf?: number; stickLength?: number } = {}): CutPlan {
  const kerf = opts.kerf ?? 0.0625;
  const stickLength = opts.stickLength ?? STICK_LENGTH;
  const groups = new Map<string, Part>();
  for (const info of Object.values(analysis.pipes)) {
    const length = roundCut(Math.max(0, info.cutLength));
    const marks = canonicalMarks(info, length);
    const key = `${info.size}|${length}|${marks.join(',')}`;
    const g = groups.get(key);
    if (g) g.pipeIds.push(info.id);
    else groups.set(key, { mark: '', size: info.size, length, pipeIds: [info.id], marks });
  }
  // Longest parts first; size order keeps 1/2, 3/4, 1 together.
  const parts = [...groups.values()].sort(
    (x, y) =>
      PIPE_SIZES.indexOf(x.size) - PIPE_SIZES.indexOf(y.size) ||
      y.length - x.length ||
      x.marks.length - y.marks.length ||
      x.marks.join(',').localeCompare(y.marks.join(',')),
  );
  parts.forEach((p, i) => {
    p.mark = markFor(i);
    p.pipeIds.sort();
  });
  const partByPipe: Record<string, Part> = {};
  for (const p of parts) for (const id of p.pipeIds) partByPipe[id] = p;

  const sticks: Stick[] = [];
  const overLength: string[] = [];
  const totalLengthBySize: Partial<Record<PipeSize, number>> = {};
  for (const size of PIPE_SIZES) {
    const cuts: StickCut[] = [];
    for (const p of parts.filter((x) => x.size === size))
      for (const id of p.pipeIds) {
        totalLengthBySize[size] = (totalLengthBySize[size] ?? 0) + p.length;
        if (p.length > stickLength + 1e-9) overLength.push(id);
        else cuts.push({ mark: p.mark, length: p.length, pipeId: id });
      }
    cuts.sort((x, y) => y.length - x.length || x.mark.localeCompare(y.mark));
    const open: Stick[] = [];
    for (const cut of cuts) {
      // Best fit: the stick whose remaining length after this cut is smallest.
      let best: Stick | undefined;
      let bestLeft = Infinity;
      for (const s of open) {
        const need = cut.length + (s.cuts.length ? kerf : 0);
        const left = stickLength - s.used - need;
        if (left >= -1e-9 && left < bestLeft) {
          best = s;
          bestLeft = left;
        }
      }
      if (!best) {
        best = { size, cuts: [], used: 0, offcut: stickLength };
        open.push(best);
      }
      best.used += cut.length + (best.cuts.length ? kerf : 0);
      best.cuts.push(cut);
      best.offcut = Math.max(0, stickLength - best.used);
    }
    sticks.push(...open);
  }
  const sticksBySize: Partial<Record<PipeSize, number>> = {};
  for (const s of sticks) sticksBySize[s.size] = (sticksBySize[s.size] ?? 0) + 1;
  // Pipes longer than a stick still need material: count whole sticks for them.
  for (const id of overLength) {
    const p = partByPipe[id];
    sticksBySize[p.size] = (sticksBySize[p.size] ?? 0) + Math.ceil(p.length / stickLength);
  }
  return { parts, partByPipe, sticks, sticksBySize, overLength, totalLengthBySize };
}

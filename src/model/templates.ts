// Parametric starter designs. Every template is a plain function of its
// dimensions (inches) so the template picker can offer them as small
// configurators. Frames are laid out with X = width, Z = depth, Y = height,
// standing on the floor at Y = 0.

import { newId } from './ids';
import type { Design, Pipe, PipeSize } from './types';
import type { V3 } from './vec';

export interface TemplateParam {
  key: string;
  label: string;
  default: number;
  min: number;
  max: number;
  /** 'length' values are shown in the user's units; 'count' values are plain integers. */
  kind: 'length' | 'count';
}

export interface Template {
  id: string;
  name: string;
  blurb: string;
  params: TemplateParam[];
  build: (v: Record<string, number>, size: PipeSize) => Pipe[];
}

const P = (a: V3, b: V3, size: PipeSize): Pipe => ({ id: newId(), a, b, size });

/** Four legs + rectangular frames at the given heights. Top frame sits on the leg tops. */
function boxFrame(w: number, d: number, levels: number[], size: PipeSize, support: boolean): Pipe[] {
  const top = Math.max(...levels);
  const pipes: Pipe[] = [];
  for (const [x, z] of [
    [0, 0],
    [w, 0],
    [w, d],
    [0, d],
  ] as const)
    pipes.push(P([x, 0, z], [x, top, z], size));
  for (const y of levels) {
    pipes.push(P([0, y, 0], [w, y, 0], size));
    pipes.push(P([0, y, d], [w, y, d], size));
    pipes.push(P([0, y, 0], [0, y, d], size));
    pipes.push(P([w, y, 0], [w, y, d], size));
    if (support) pipes.push(P([w / 2, y, 0], [w / 2, y, d], size));
  }
  return pipes;
}

function evenLevels(bottom: number, top: number, count: number): number[] {
  if (count <= 1) return [top];
  const step = (top - bottom) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round((bottom + step * i) * 4) / 4);
}

export const TEMPLATES: Template[] = [
  {
    id: 'shelf',
    name: 'Shelving unit',
    blurb: 'Four posts with evenly spaced shelf frames and a centre support under each shelf.',
    params: [
      { key: 'w', label: 'Width', default: 36, min: 12, max: 96, kind: 'length' },
      { key: 'd', label: 'Depth', default: 18, min: 8, max: 48, kind: 'length' },
      { key: 'h', label: 'Height', default: 60, min: 18, max: 96, kind: 'length' },
      { key: 'n', label: 'Shelves', default: 3, min: 2, max: 8, kind: 'count' },
    ],
    build: (v, size) => boxFrame(v.w, v.d, evenLevels(6, v.h, v.n), size, v.w > 30),
  },
  {
    id: 'bench',
    name: 'Workbench',
    blurb: 'Bench frame with a lower shelf and 45° knee braces on the long sides.',
    params: [
      { key: 'w', label: 'Width', default: 60, min: 24, max: 96, kind: 'length' },
      { key: 'd', label: 'Depth', default: 24, min: 12, max: 48, kind: 'length' },
      { key: 'h', label: 'Height', default: 36, min: 24, max: 48, kind: 'length' },
    ],
    build: (v, size) => {
      const { w, d, h } = v;
      const pipes = boxFrame(w, d, [8, h], size, true);
      const k = Math.min(10, Math.floor((h - 8) / 2), Math.floor(w / 4));
      for (const z of [0, d]) {
        pipes.push(P([0, h - k, z], [k, h, z], size));
        pipes.push(P([w, h - k, z], [w - k, h, z], size));
      }
      return pipes;
    },
  },
  {
    id: 'cube',
    name: 'Cube frame',
    blurb: 'Twelve equal edges. Every corner is a 90 Degree Connector.',
    params: [{ key: 's', label: 'Edge', default: 24, min: 6, max: 96, kind: 'length' }],
    build: (v, size) => {
      const s = v.s;
      // Posts and the top square, plus the floor square on the post bottoms.
      return boxFrame(s, s, [s], size, false).concat([
        P([0, 0, 0], [s, 0, 0], size),
        P([0, 0, s], [s, 0, s], size),
        P([0, 0, 0], [0, 0, s], size),
        P([s, 0, 0], [s, 0, s], size),
      ]);
    },
  },
  {
    id: 'rack',
    name: 'Garment rack',
    blurb: 'Two uprights on T-foot bases, a hanging rail and a lower stretcher.',
    params: [
      { key: 'w', label: 'Width', default: 48, min: 24, max: 96, kind: 'length' },
      { key: 'h', label: 'Height', default: 60, min: 36, max: 84, kind: 'length' },
      { key: 'd', label: 'Foot length', default: 18, min: 12, max: 30, kind: 'length' },
    ],
    build: (v, size) => {
      const { w, h, d } = v;
      const c = d / 2;
      return [
        P([0, 0, 0], [0, 0, d], size),
        P([w, 0, 0], [w, 0, d], size),
        P([0, 0, c], [0, h, c], size),
        P([w, 0, c], [w, h, c], size),
        P([0, h, c], [w, h, c], size),
        P([0, 10, c], [w, 10, c], size),
      ];
    },
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse frame',
    blurb: 'Walls with a 45° pitched roof. Rafter pairs meet the ridge in 90 Degree Connectors.',
    params: [
      { key: 'w', label: 'Length', default: 72, min: 36, max: 120, kind: 'length' },
      { key: 'd', label: 'Width', default: 48, min: 24, max: 96, kind: 'length' },
      { key: 'h', label: 'Wall height', default: 48, min: 24, max: 84, kind: 'length' },
      { key: 'n', label: 'Rafter pairs', default: 3, min: 1, max: 8, kind: 'count' },
    ],
    build: (v, size) => {
      const { w, d, h, n } = v;
      const pipes = boxFrame(w, d, [h], size, false);
      pipes.push(P([0, 0, 0], [w, 0, 0], size), P([0, 0, d], [w, 0, d], size));
      const ridgeY = h + d / 2;
      pipes.push(P([0, ridgeY, d / 2], [w, ridgeY, d / 2], size));
      pipes.push(P([0, h, d / 2], [0, ridgeY, d / 2], size), P([w, h, d / 2], [w, ridgeY, d / 2], size));
      for (let i = 1; i <= n; i++) {
        const x = Math.round(((w * i) / (n + 1)) * 4) / 4;
        pipes.push(P([x, h, 0], [x, ridgeY, d / 2], size), P([x, h, d], [x, ridgeY, d / 2], size));
      }
      return pipes;
    },
  },
];

export function templateDefaults(t: Template): Record<string, number> {
  return Object.fromEntries(t.params.map((p) => [p.key, p.default]));
}

export function designFromTemplate(t: Template, values: Record<string, number>, size: PipeSize): Design {
  // Missing or out-of-range values fall back to the defaults / limits.
  const v = templateDefaults(t);
  for (const p of t.params) {
    const x = values[p.key];
    if (typeof x === 'number' && Number.isFinite(x)) v[p.key] = Math.min(p.max, Math.max(p.min, p.kind === 'count' ? Math.round(x) : x));
  }
  return {
    version: 1,
    name: t.name,
    pipes: t.build(v, size),
    joints: {},
    defaultEnd: 'cap',
  };
}

export function emptyDesign(): Design {
  return { version: 1, name: 'Untitled frame', pipes: [], joints: {}, defaultEnd: 'cap' };
}

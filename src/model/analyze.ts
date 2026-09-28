// Joint analysis: finds where pipes meet, works out which Maker Pipe connector
// (or connectors) each meeting point needs, and derives the physical cut
// length of every pipe from how its ends are held.
//
// Vocabulary (matches Maker Pipe's own product copy):
//   through pipe      - a pipe that passes through a connector's clamp
//   terminating pipe  - a pipe whose end is gripped by a connector ("arm")
// Every connector except the coupling clamps exactly one through pipe. Where
// all pipes at a point end there (an elbow or a box corner) one of them is
// "promoted": it is cut a little longer so it runs through the connector.

import { CONNECTOR_DIMS, STICK_LENGTH, overhang, radius } from '../catalog/emt';
import type { ConnectorKind, Design, EndFitting, Issue, JointOverride, Pipe, PipeSize } from './types';
import { PIPE_SIZES } from './types';
import {
  type V3,
  add,
  angleDeg,
  closestOnSegment,
  dist,
  dot,
  len,
  lineAngleDeg,
  neg,
  norm,
  pointKey,
  scale,
  segmentSegment,
  sub,
} from './vec';
import { formatInches } from './units';

/** Points closer than this (inches) are the same point. */
export const POINT_TOL = 0.02;
/** Angle tolerance (degrees) for matching 45 / 90 / 135 / 180. */
export const ANGLE_TOL = 1.5;
/** Smallest pipe-to-pipe angle the adjustable connectors can hold. */
export const MIN_ADJUSTABLE_ANGLE = 20;

export interface JointMember {
  pipeId: string;
  role: 'end' | 'through';
  /** For 'end' members, which end of the pipe sits at the joint. */
  end?: 'a' | 'b';
  /** 'end': unit vector from the joint into the pipe. 'through': unit pipe axis a->b. */
  dir: V3;
}

export interface Arm {
  pipeId: string;
  /** Unit vector from the joint along the terminating pipe. */
  dir: V3;
  /** Distance from the joint centre to the pipe's cut end. */
  setback: number;
}

/** Adapter shim letting a connector hold the next smaller EMT size. */
export type ShimKind = '3/4-1/2' | '1-3/4';

export interface PlacedConnector {
  id: string;
  kind: ConnectorKind;
  size: PipeSize;
  jointKey: string;
  pos: V3;
  /** Pipe held by the clamp. Undefined for couplings. */
  throughPipeId?: string;
  /** Unit axis of the through pipe, pointing into the pipe for promoted pipes. */
  axis: V3;
  arms: Arm[];
  /** The through pipe was promoted from an end at this joint. */
  promoted: boolean;
  /** Shims needed because a pipe is one size smaller than the connector. */
  shims: { pipeId: string; kind: ShimKind }[];
}

export type FittingKind = Exclude<EndFitting, 'open'>;

export interface PlacedFitting {
  id: string;
  kind: FittingKind;
  size: PipeSize;
  pipeId: string;
  end: 'a' | 'b';
  /** Physical end point of the pipe. */
  pos: V3;
  /** Unit vector pointing out of the pipe end. */
  dir: V3;
}

export interface Joint {
  key: string;
  pos: V3;
  members: JointMember[];
  connectorIds: string[];
  throughPipeId?: string;
  promoted: boolean;
  /** Pipes that could be the through pipe (only when every pipe ends here). */
  throughCandidates: string[];
  compound: boolean;
}

export interface PipeEnd {
  end: 'a' | 'b';
  jointKey?: string;
  /** How the end is held. */
  hold: 'free' | 'arm' | 'overhang' | 'coupling';
  fitting?: EndFitting;
  /** Inches added to the centreline length at this end (negative = shorter). */
  adjust: number;
}

export interface ThroughMark {
  jointKey: string;
  connectorId: string;
  /** Distance from the pipe's physical end A to the connector centre. */
  fromA: number;
  /** The connector sits on a promoted end (elbow/corner) rather than mid-pipe. */
  atEnd: boolean;
}

export interface PipeInfo {
  id: string;
  size: PipeSize;
  centerLength: number;
  cutLength: number;
  /** Unit axis a->b. */
  axis: V3;
  physA: V3;
  physB: V3;
  ends: { a: PipeEnd; b: PipeEnd };
  /** Connectors clamping this pipe, sorted from end A. */
  marks: ThroughMark[];
}

export interface Analysis {
  joints: Joint[];
  jointsByKey: Record<string, Joint>;
  connectors: PlacedConnector[];
  connectorsById: Record<string, PlacedConnector>;
  fittings: PlacedFitting[];
  pipes: Record<string, PipeInfo>;
  issues: Issue[];
}

interface EndRef {
  pipe: Pipe;
  end: 'a' | 'b';
  p: V3;
}

/** Group pipe end points that coincide. */
function clusterEnds(pipes: Pipe[]): EndRef[][] {
  const grid = new Map<string, EndRef[][]>();
  const clusters: EndRef[][] = [];
  const cellKey = (p: V3, dx = 0, dy = 0, dz = 0) =>
    `${Math.floor(p[0]) + dx},${Math.floor(p[1]) + dy},${Math.floor(p[2]) + dz}`;
  for (const pipe of pipes) {
    for (const end of ['a', 'b'] as const) {
      const p = pipe[end];
      let found: EndRef[] | undefined;
      outer: for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            for (const c of grid.get(cellKey(p, dx, dy, dz)) ?? []) {
              if (dist(c[0].p, p) <= POINT_TOL) {
                found = c;
                break outer;
              }
            }
          }
      const ref: EndRef = { pipe, end, p };
      if (found) found.push(ref);
      else {
        const c = [ref];
        clusters.push(c);
        const k = cellKey(p);
        const list = grid.get(k);
        if (list) list.push(c);
        else grid.set(k, [c]);
      }
    }
  }
  return clusters;
}

interface ArmPlan {
  kind: ConnectorKind;
  arms: JointMember[];
}

interface Partition {
  plans: ArmPlan[];
  errors: string[];
}

/** Direction of `dir` in the plane square to `axis` (the arm's "compass bearing" around the through pipe). */
function bearing(axis: V3, dir: V3): V3 {
  return norm(sub(dir, scale(axis, dot(dir, axis))));
}

const near = (a: number, b: number) => Math.abs(a - b) <= ANGLE_TOL;

/** Arm patterns for connectors whose arms are all square to the through pipe, largest first. */
const RADIAL_PATTERNS: { kind: ConnectorKind; angles: number[] }[] = [
  { kind: '5way', angles: [90, 90, 90, 90, 180, 180] },
  { kind: '4way', angles: [90, 90, 180] },
  { kind: '180', angles: [180] },
  { kind: '90', angles: [90] },
  { kind: '135', angles: [135] },
];

function combos<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...rest] = items;
  return combos(rest, k - 1)
    .map((c) => [head, ...c])
    .concat(combos(rest, k));
}

function matchesPattern(axis: V3, arms: JointMember[], angles: number[]): boolean {
  const got: number[] = [];
  for (let i = 0; i < arms.length; i++)
    for (let j = i + 1; j < arms.length; j++) got.push(angleDeg(bearing(axis, arms[i].dir), bearing(axis, arms[j].dir)));
  got.sort((x, y) => x - y);
  const want = [...angles].sort((x, y) => x - y);
  return got.length === want.length && got.every((g, i) => near(g, want[i]));
}

/** Split the pipe ends meeting a through pipe into the fewest connectors. */
function partitionArms(axis: V3, arms: JointMember[], override: JointOverride | undefined): Partition {
  const perp: JointMember[] = [];
  const angled: JointMember[] = [];
  const errors: string[] = [];
  for (const m of arms) {
    const a = lineAngleDeg(axis, m.dir);
    if (a >= 90 - ANGLE_TOL) perp.push(m);
    else if (a < MIN_ADJUSTABLE_ANGLE) errors.push(`A pipe meets the through pipe at ${a.toFixed(0)}°, too shallow for any connector.`);
    else angled.push(m);
  }

  const plans: ArmPlan[] = [];
  let left = [...perp];
  for (const pattern of RADIAL_PATTERNS) {
    const k = pattern.angles.length === 1 ? 2 : pattern.angles.length === 3 ? 3 : 4;
    let found = true;
    while (found && left.length >= k) {
      found = false;
      for (const c of combos(left, k)) {
        if (matchesPattern(axis, c, pattern.angles)) {
          plans.push({ kind: pattern.kind, arms: c });
          left = left.filter((m) => !c.includes(m));
          found = true;
          break;
        }
      }
    }
  }

  // Two arms on opposite sides where at least one is tilted: Adjustable 180.
  const singles = [...left, ...angled];
  const used = new Set<JointMember>();
  for (let i = 0; i < singles.length; i++)
    for (let j = i + 1; j < singles.length; j++) {
      const x = singles[i];
      const y = singles[j];
      if (used.has(x) || used.has(y)) continue;
      if (!angled.includes(x) && !angled.includes(y)) continue;
      if (near(angleDeg(bearing(axis, x.dir), bearing(axis, y.dir)), 180)) {
        plans.push({ kind: 'adjustable-180', arms: [x, y] });
        used.add(x);
        used.add(y);
      }
    }
  for (const m of singles) {
    if (used.has(m)) continue;
    const a = lineAngleDeg(axis, m.dir);
    let kind: ConnectorKind;
    if (a >= 90 - ANGLE_TOL) kind = 't';
    else if (near(a, 45)) kind = '45';
    else kind = 'adjustable';
    if (override?.preferAdjustable && (kind === 't' || kind === '45')) kind = 'adjustable';
    plans.push({ kind, arms: [m] });
  }
  return { plans, errors };
}

const planCost = (p: Partition) =>
  p.errors.length * 1000 +
  p.plans.length * 10 +
  p.plans.filter((x) => x.kind === 'adjustable' || x.kind === 'adjustable-180').length;

/**
 * Which pipe to run through an elbow or corner connector when the geometry
 * allows several. A post whose top is at the joint is best (it pokes up a
 * little, like Maker Pipe's own builds). Horizontal pipes come next, X before
 * Z so every rectangle gets the same two long and two short sides. A post
 * whose bottom is at the joint comes last: its overhang would go into the floor.
 */
function promotionPreference(dirIntoPipe: V3): number {
  if (dirIntoPipe[1] < -0.99) return 5;
  if (Math.abs(dirIntoPipe[0]) > 0.99) return 4;
  if (Math.abs(dirIntoPipe[2]) > 0.99) return 3;
  if (dirIntoPipe[1] > 0.99) return 1;
  return 2;
}

const isHinged = (kind: ConnectorKind) => kind === 'adjustable' || kind === 'adjustable-180';

/** Distance from the joint centre to the square-cut end of a terminating pipe. */
function armSetback(kind: ConnectorKind, throughSize: PipeSize, armSize: PipeSize, axis: V3, dir: V3): number {
  const R = radius(throughSize) + 0.02;
  const r = radius(armSize);
  const alpha = (Math.max(MIN_ADJUSTABLE_ANGLE, lineAngleDeg(axis, dir)) * Math.PI) / 180;
  const clear = (R + r * Math.cos(alpha)) / Math.sin(alpha);
  return isHinged(kind) ? clear + CONNECTOR_DIMS[throughSize].hingeOffset : clear;
}

const sizeRank = (s: PipeSize) => PIPE_SIZES.indexOf(s);

export function analyze(design: Design): Analysis {
  const issues: Issue[] = [];
  const pipes = design.pipes.filter((p) => {
    if (dist(p.a, p.b) < 0.25) {
      issues.push({ level: 'error', message: 'A pipe has (almost) zero length.', pipeIds: [p.id], pos: p.a });
      return false;
    }
    return true;
  });
  const byId: Record<string, Pipe> = Object.fromEntries(pipes.map((p) => [p.id, p]));
  const axisOf = (p: Pipe) => norm(sub(p.b, p.a));

  const infos: Record<string, PipeInfo> = {};
  for (const p of pipes) {
    const centerLength = dist(p.a, p.b);
    infos[p.id] = {
      id: p.id,
      size: p.size,
      centerLength,
      cutLength: centerLength,
      axis: axisOf(p),
      physA: p.a,
      physB: p.b,
      ends: { a: { end: 'a', hold: 'free', adjust: 0 }, b: { end: 'b', hold: 'free', adjust: 0 } },
      marks: [],
    };
  }

  const joints: Joint[] = [];
  const connectors: PlacedConnector[] = [];
  const fittings: PlacedFitting[] = [];

  /** Connector size is the largest pipe it holds; smaller pipes get a shim. */
  const sizeAndShims = (pipeIds: string[], key: string, pos: V3) => {
    const size = pipeIds.map((id) => byId[id].size).reduce((a, b) => (sizeRank(b) > sizeRank(a) ? b : a));
    const shims: PlacedConnector['shims'] = [];
    for (const id of pipeIds) {
      const s = byId[id].size;
      if (s === size) continue;
      if (size === '3/4' && s === '1/2') shims.push({ pipeId: id, kind: '3/4-1/2' });
      else if (size === '1' && s === '3/4') shims.push({ pipeId: id, kind: '1-3/4' });
      else
        issues.push({
          level: 'warning',
          message: 'A 1/2 in pipe meets a 1 in pipe. No single adapter shim bridges two sizes; use 3/4 in pipe for one of them.',
          pipeIds,
          jointKey: key,
          pos,
        });
    }
    return { size, shims };
  };

  for (const cluster of clusterEnds(pipes)) {
    const pos = cluster[0].p;
    const key = pointKey(pos);
    const members: JointMember[] = cluster.map((r) => ({
      pipeId: r.pipe.id,
      role: 'end' as const,
      end: r.end,
      dir: r.end === 'a' ? axisOf(r.pipe) : neg(axisOf(r.pipe)),
    }));
    const inCluster = new Set(cluster.map((r) => r.pipe.id));
    for (const q of pipes) {
      if (inCluster.has(q.id)) continue;
      const c = closestOnSegment(pos, q.a, q.b);
      const along = c.t * dist(q.a, q.b);
      if (c.d <= POINT_TOL && along > POINT_TOL && dist(q.a, q.b) - along > POINT_TOL) {
        members.push({ pipeId: q.id, role: 'through', dir: axisOf(q) });
      }
    }

    // A lone pipe end: free end, gets its end fitting.
    if (members.length === 1) {
      const m = members[0];
      const pipe = byId[m.pipeId];
      const end = m.end!;
      const fitting = (end === 'a' ? pipe.endA : pipe.endB) ?? design.defaultEnd;
      infos[pipe.id].ends[end] = { end, hold: 'free', fitting, adjust: 0 };
      if (fitting !== 'open') {
        fittings.push({ id: `${pipe.id}:${end}`, kind: fitting, size: pipe.size, pipeId: pipe.id, end, pos, dir: neg(m.dir) });
      }
      continue;
    }

    const override = design.joints[key];
    const joint: Joint = { key, pos, members, connectorIds: [], promoted: false, throughCandidates: [], compound: false };
    joints.push(joint);

    const throughs = members.filter((m) => m.role === 'through');
    const ends = members.filter((m) => m.role === 'end');

    if (throughs.length >= 2) {
      issues.push({
        level: 'error',
        message: 'Two pipes pass through the same point. Offset one of them, or split it so it ends here.',
        pipeIds: throughs.map((m) => m.pipeId),
        jointKey: key,
        pos,
      });
      continue;
    }

    // Two ends meeting in a straight line: a splice with a Structural Coupling.
    if (throughs.length === 0 && ends.length === 2 && angleDeg(ends[0].dir, ends[1].dir) >= 180 - ANGLE_TOL) {
      const [e0, e1] = ends;
      const id = `${key}#0`;
      const { size, shims } = sizeAndShims([e0.pipeId, e1.pipeId], key, pos);
      connectors.push({
        id,
        kind: 'coupling',
        size,
        jointKey: key,
        pos,
        axis: e1.dir,
        arms: [
          { pipeId: e0.pipeId, dir: e0.dir, setback: 0 },
          { pipeId: e1.pipeId, dir: e1.dir, setback: 0 },
        ],
        promoted: false,
        shims,
      });
      joint.connectorIds.push(id);
      for (const e of ends) infos[e.pipeId].ends[e.end!] = { end: e.end!, jointKey: key, hold: 'coupling', adjust: 0 };
      continue;
    }

    // Pick the through pipe.
    let through: JointMember;
    let part: Partition;
    let promoted = false;
    if (throughs.length === 1) {
      through = throughs[0];
      part = partitionArms(through.dir, ends, override);
    } else {
      const options = ends.map((cand) => ({ cand, part: partitionArms(cand.dir, ends.filter((m) => m !== cand), override) }));
      const valid = options.filter((o) => o.part.errors.length === 0);
      const pool = valid.length ? valid : options;
      const best = Math.min(...pool.map((o) => planCost(o.part)));
      const ranked = pool
        .filter((o) => planCost(o.part) === best)
        .sort((x, y) => {
          const px = promotionPreference(x.cand.dir);
          const py = promotionPreference(y.cand.dir);
          if (px !== py) return py - px;
          const lx = infos[x.cand.pipeId].centerLength;
          const ly = infos[y.cand.pipeId].centerLength;
          if (Math.abs(lx - ly) > 1e-6) return ly - lx;
          return x.cand.pipeId < y.cand.pipeId ? -1 : 1;
        });
      joint.throughCandidates = valid.map((o) => o.cand.pipeId);
      const chosen = valid.find((o) => o.cand.pipeId === override?.throughPipeId) ?? ranked[0];
      through = chosen.cand;
      part = chosen.part;
      promoted = true;
    }

    joint.throughPipeId = through.pipeId;
    joint.promoted = promoted;
    const tSize = byId[through.pipeId].size;
    const axis = through.dir;

    for (const err of part.errors) issues.push({ level: 'error', message: err, pipeIds: members.map((m) => m.pipeId), jointKey: key, pos });

    const placed = part.plans.map((plan, i): PlacedConnector => {
      const armList: Arm[] = plan.arms.map((m) => {
        const setback = armSetback(plan.kind, tSize, byId[m.pipeId].size, axis, m.dir);
        infos[m.pipeId].ends[m.end!] = { end: m.end!, jointKey: key, hold: 'arm', adjust: -setback };
        return { pipeId: m.pipeId, dir: m.dir, setback };
      });
      const { size, shims } = sizeAndShims([through.pipeId, ...plan.arms.map((m) => m.pipeId)], key, pos);
      return { id: `${key}#${i}`, kind: plan.kind, size, jointKey: key, pos, throughPipeId: through.pipeId, axis, arms: armList, promoted, shims };
    });
    connectors.push(...placed);
    joint.connectorIds.push(...placed.map((c) => c.id));

    if (promoted) {
      // The through pipe runs past the joint far enough to fill the clamp, and
      // further when an arm leans back over the pipe end.
      let extra = overhang(tSize);
      for (const c of placed)
        for (const arm of c.arms) extra = Math.max(extra, -dot(arm.dir, axis) * arm.setback + overhang(tSize));
      infos[through.pipeId].ends[through.end!] = { end: through.end!, jointKey: key, hold: 'overhang', adjust: extra };
    }

    if (part.plans.length > 1) {
      joint.compound = true;
      issues.push({
        level: 'warning',
        message: `${part.plans.length} connectors are needed at one point. They cannot share one spot on the through pipe: move the pipe ends at least ${formatInches(CONNECTOR_DIMS[tSize].clampLength + 0.25)} apart along it.`,
        pipeIds: members.map((m) => m.pipeId),
        jointKey: key,
        pos,
      });
    }
  }

  // Physical ends and cut lengths.
  for (const info of Object.values(infos)) {
    const p = byId[info.id];
    const { a, b } = info.ends;
    info.cutLength = info.centerLength + a.adjust + b.adjust;
    info.physA = add(p.a, scale(info.axis, -a.adjust));
    info.physB = add(p.b, scale(info.axis, b.adjust));
  }

  // Fittings sit on the physical ends (identical to the centreline ends for free ends).
  for (const f of fittings) f.pos = f.end === 'a' ? infos[f.pipeId].physA : infos[f.pipeId].physB;

  // Connector positions along through pipes, for marking and spacing checks.
  for (const c of connectors) {
    if (!c.throughPipeId) continue;
    const info = infos[c.throughPipeId];
    const p = byId[c.throughPipeId];
    info.marks.push({ jointKey: c.jointKey, connectorId: c.id, fromA: dist(p.a, c.pos) + info.ends.a.adjust, atEnd: c.promoted });
  }
  for (const info of Object.values(infos)) {
    info.marks.sort((x, y) => x.fromA - y.fromA);
    const clamp = CONNECTOR_DIMS[info.size].clampLength;
    for (let i = 1; i < info.marks.length; i++) {
      const gap = info.marks[i].fromA - info.marks[i - 1].fromA;
      if (gap > POINT_TOL && gap < clamp) {
        issues.push({
          level: 'warning',
          message: `Two connectors on one pipe are only ${formatInches(gap)} apart, so their clamps overlap. Keep them at least ${formatInches(clamp)} apart.`,
          pipeIds: [info.id],
        });
      }
    }
  }

  // Per-pipe checks.
  for (const info of Object.values(infos)) {
    if (info.cutLength > STICK_LENGTH + 1e-6) {
      issues.push({
        level: 'warning',
        message: `A pipe is ${formatInches(info.cutLength, { feet: true })} long, more than one 10 ft stick. Split it and join the pieces with a Structural Coupling.`,
        pipeIds: [info.id],
      });
    }
    const held = [info.ends.a, info.ends.b].filter((e) => e.hold === 'arm').length;
    const min = held === 2 ? 2 : 1;
    if (info.cutLength < min) {
      issues.push({
        level: 'error',
        message: `A pipe would be cut to ${formatInches(Math.max(0, info.cutLength))}, too short to grip. Move its ends further apart.`,
        pipeIds: [info.id],
      });
    }
  }

  // Pipes that run into each other without a joint.
  const jointPairs = new Set<string>();
  for (const j of joints) {
    const ids = j.members.map((m) => m.pipeId);
    for (const x of ids) for (const y of ids) if (x < y) jointPairs.add(`${x}|${y}`);
  }
  for (let i = 0; i < pipes.length; i++)
    for (let k = i + 1; k < pipes.length; k++) {
      const p = pipes[i];
      const q = pipes[k];
      const pairKey = p.id < q.id ? `${p.id}|${q.id}` : `${q.id}|${p.id}`;
      if (jointPairs.has(pairKey)) continue;
      const ip = infos[p.id];
      const iq = infos[q.id];
      const r = segmentSegment(ip.physA, ip.physB, iq.physA, iq.physB);
      if (r.d < radius(p.size) + radius(q.size) - 0.05) {
        issues.push({
          level: 'error',
          message: 'Two pipes run into each other without a connector. Move one, or end one pipe on the other to make a joint.',
          pipeIds: [p.id, q.id],
          pos: add(ip.physA, scale(sub(ip.physB, ip.physA), r.s)),
        });
      }
    }

  return {
    joints,
    jointsByKey: Object.fromEntries(joints.map((j) => [j.key, j])),
    connectors,
    connectorsById: Object.fromEntries(connectors.map((c) => [c.id, c])),
    fittings,
    pipes: infos,
    issues,
  };
}

/** Overall bounding box of the physical pipes. */
export function bounds(analysis: Analysis): { min: V3; max: V3; size: V3 } | null {
  const infos = Object.values(analysis.pipes);
  if (!infos.length) return null;
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const info of infos) {
    const r = radius(info.size);
    for (const p of [info.physA, info.physB])
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], p[i] - r);
        max[i] = Math.max(max[i], p[i] + r);
      }
  }
  return { min, max, size: sub(max, min) };
}

export const pipeLength = (p: Pipe): number => len(sub(p.b, p.a));

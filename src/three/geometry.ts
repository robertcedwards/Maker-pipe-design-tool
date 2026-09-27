// Procedural meshes for EMT pipe, the connectors and the end fittings.
// Everything is built in inches, in world space, from the analysed joints.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONNECTOR_DIMS, EMT, radius } from '../catalog/emt';
import type { PlacedConnector, PlacedFitting } from '../model/analyze';
import type { PipeSize } from '../model/types';
import { type V3, add, cross, dot, norm, scale, sub, anyPerp } from '../model/vec';

const Y = new THREE.Vector3(0, 1, 0);
const v = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

/** Tube (outer wall, inner wall and ring ends) from y=0 to y=1 for one EMT size. */
function tube(ro: number, ri: number, segments = 28): THREE.BufferGeometry {
  const outer = new THREE.CylinderGeometry(ro, ro, 1, segments, 1, true).translate(0, 0.5, 0);
  const inner = new THREE.CylinderGeometry(ri, ri, 1, segments, 1, true).translate(0, 0.5, 0);
  flip(inner);
  const top = new THREE.RingGeometry(ri, ro, segments).rotateX(-Math.PI / 2).translate(0, 1, 0);
  const bottom = new THREE.RingGeometry(ri, ro, segments).rotateX(Math.PI / 2);
  const g = mergeGeometries([outer, inner, top, bottom].map(clean))!;
  return g;
}

/** Keep only position/normal so different primitives merge. */
function clean(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g.clone();
  for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  return out;
}

/** Turn a surface inside out (for the inner wall of a tube). */
function flip(g: THREE.BufferGeometry) {
  const idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, a);
  }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
}

const pipeGeoms = new Map<PipeSize, THREE.BufferGeometry>();

/** Shared unit-length pipe geometry per size; scale Y to the pipe length. */
export function pipeGeometry(size: PipeSize): THREE.BufferGeometry {
  let g = pipeGeoms.get(size);
  if (!g) {
    const ro = EMT[size].od / 2;
    g = tube(ro, ro - Math.max(EMT[size].wall, 0.05));
    pipeGeoms.set(size, g);
  }
  return g;
}

/** Position/rotation/scale placing the unit pipe between two points. */
export function pipeTransform(a: V3, b: V3): { position: THREE.Vector3; quaternion: THREE.Quaternion; length: number } {
  const dir = sub(b, a);
  const length = Math.hypot(dir[0], dir[1], dir[2]);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(Y, v(norm(dir)));
  return { position: v(a), quaternion, length };
}

// ---------------------------------------------------------------------------
// Building blocks, all returned in world space.

/** Solid or open cylinder between two points. */
function rod(from: V3, to: V3, r: number, open = false, segments = 20): THREE.BufferGeometry {
  const d = sub(to, from);
  const l = Math.hypot(d[0], d[1], d[2]);
  const g = new THREE.CylinderGeometry(r, r, l, segments, 1, open).translate(0, l / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, v(norm(d))));
  g.translate(from[0], from[1], from[2]);
  return clean(g);
}

/** Thick band (tube with ring ends) around an axis, between two points. */
function band(from: V3, to: V3, ri: number, ro: number, segments = 24): THREE.BufferGeometry {
  const d = sub(to, from);
  const l = Math.hypot(d[0], d[1], d[2]);
  const g = tube(ro, ri, segments);
  g.scale(1, l, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, v(norm(d))));
  g.translate(from[0], from[1], from[2]);
  return g;
}

/** Hex bolt head (or nut) sitting on a surface, facing `out`. */
function hex(at: V3, out: V3, r = 0.2, h = 0.18): THREE.BufferGeometry {
  return rod(at, add(at, scale(out, h)), r, false, 6);
}

/** Box with its centre at `at`, size along the given unit axes. */
function box(at: V3, ax: V3, ay: V3, az: V3, sx: number, sy: number, sz: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const m = new THREE.Matrix4().makeBasis(v(ax), v(ay), v(az));
  m.setPosition(v(at));
  g.applyMatrix4(m);
  return clean(g);
}

// ---------------------------------------------------------------------------
// Connectors

export interface ConnectorMesh {
  body: THREE.BufferGeometry;
  bolts: THREE.BufferGeometry;
}

export function connectorGeometry(c: PlacedConnector): ConnectorMesh {
  const dims = CONNECTOR_DIMS[c.size];
  const R = radius(c.size);
  const shell = dims.shell;
  const parts: THREE.BufferGeometry[] = [];
  const bolts: THREE.BufferGeometry[] = [];
  const p = c.pos;

  if (c.kind === 'coupling') {
    const ax = c.axis;
    const half = dims.clampLength * 0.75;
    parts.push(band(add(p, scale(ax, -half)), add(p, scale(ax, half)), R, R + shell));
    const side = anyPerp(ax);
    bolts.push(hex(add(p, scale(side, R + shell)), side));
    return { body: mergeGeometries(parts)!, bolts: mergeGeometries(bolts)! };
  }

  const t = c.axis;
  // Through clamp, centred on the joint.
  const half = dims.clampLength / 2;
  parts.push(band(add(p, scale(t, -half)), add(p, scale(t, half)), R + 0.005, R + shell));

  for (const arm of c.arms) {
    const d = arm.dir;
    const r = radius(c.size);
    const along = dot(d, t);
    const bearing = norm(sub(d, scale(t, along)));
    const n = norm(cross(t, bearing));
    const hinged = c.kind === 'adjustable' || c.kind === 'adjustable-180';
    if (hinged) {
      // Puzzle-piece clamp arm out to the pivot, knuckle, then the end clamp along the pipe.
      const pivot = add(p, scale(d, arm.setback - 0.55));
      const root = add(p, scale(bearing, R + shell * 0.5));
      parts.push(box(midpoint(root, pivot), norm(sub(pivot, root)), n, cross(norm(sub(pivot, root)), n), dist3(root, pivot), 0.5, 0.14));
      parts.push(rod(add(pivot, scale(n, -0.3)), add(pivot, scale(n, 0.3)), 0.28));
      parts.push(band(add(p, scale(d, arm.setback - 0.3)), add(p, scale(d, arm.setback + dims.sleeveLength * 1.25)), r, r + shell));
      bolts.push(hex(add(pivot, scale(n, 0.3)), n));
      bolts.push(hex(add(add(p, scale(d, arm.setback + 0.8)), scale(n, r + shell)), n, 0.18));
    } else {
      // Sleeve from the through pipe out along the arm.
      const start = Math.max(R * 0.55, arm.setback - (c.kind === '45' ? 0.9 : 0.2));
      const end = arm.setback + dims.sleeveLength;
      parts.push(band(add(p, scale(d, start)), add(p, scale(d, end)), r, r + shell));
      // Web between clamp and sleeve where the two stamped halves meet.
      const webLen = Math.max(0.3, arm.setback + 0.4);
      parts.push(box(add(p, scale(d, webLen / 2 + R * 0.4)), d, n, cross(d, n), webLen, 0.08, 2 * (r + shell) * 0.9));
      bolts.push(hex(add(p, add(scale(d, arm.setback + 0.55), scale(n, r + shell))), n));
      bolts.push(hex(add(p, add(scale(d, arm.setback + 0.55), scale(n, -(r + shell)))), scale(n, -1), 0.19, 0.2));
    }
  }
  return { body: mergeGeometries(parts)!, bolts: mergeGeometries(bolts)! };
}

const midpoint = (a: V3, b: V3): V3 => scale(add(a, b), 0.5);
const dist3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ---------------------------------------------------------------------------
// End fittings

export interface FittingMesh {
  metal?: THREE.BufferGeometry;
  rubber?: THREE.BufferGeometry;
}

/** World axis closest to a direction (for the base plate of angled flanges). */
function nearestAxis(d: V3): V3 {
  const i = [0, 1, 2].reduce((best, k) => (Math.abs(d[k]) > Math.abs(d[best]) ? k : best), 0);
  const out: V3 = [0, 0, 0];
  out[i] = Math.sign(d[i]) || 1;
  return out;
}

export function fittingGeometry(f: PlacedFitting): FittingMesh {
  const r = radius(f.size);
  const out = f.dir; // points out of the pipe end
  const p = f.pos;
  const shell = CONNECTOR_DIMS[f.size].shell;
  switch (f.kind) {
    case 'cap':
      return { rubber: rod(add(p, scale(out, -0.02)), add(p, scale(out, 0.14)), r + 0.035, false, 24) };
    case 'foot':
      return { rubber: rod(add(p, scale(out, -0.75)), add(p, scale(out, 0.22)), r + 0.13, false, 24) };
    case 'caster': {
      const plate = add(p, scale(out, 0.35));
      const wheelC = add(p, scale(out, 1.75));
      const side = anyPerp(out);
      const axle = norm(cross(out, side));
      return {
        metal: mergeGeometries([
          rod(add(p, scale(out, -0.8)), add(p, scale(out, 0.25)), r + 0.04),
          rod(add(p, scale(out, 0.25)), plate, 1.0, false, 24),
          box(add(p, scale(out, 1.1)), out, side, axle, 1.3, 0.15, 1.15),
        ])!,
        rubber: rod(add(wheelC, scale(axle, -0.45)), add(wheelC, scale(axle, 0.45)), 1.25, false, 28),
      };
    }
    case 'flange': {
      const plateN = out;
      const s = anyPerp(plateN);
      const s2 = norm(cross(plateN, s));
      return {
        metal: mergeGeometries([
          band(add(p, scale(out, -1.7)), p, r, r + shell),
          box(add(p, scale(out, 0.07)), s, plateN, s2, 3.2, 0.14, 3.2),
        ])!,
      };
    }
    case 'angle-flange': {
      const plateN = nearestAxis(out);
      const s = anyPerp(plateN);
      const s2 = norm(cross(plateN, s));
      const base = add(p, scale(out, 0.7));
      return {
        metal: mergeGeometries([
          band(add(p, scale(out, -1.9)), add(p, scale(out, 0.2)), r, r + shell),
          rod(add(base, scale(s2, -0.35)), add(base, scale(s2, 0.35)), 0.3),
          box(add(base, scale(plateN, 0.35)), s, plateN, s2, 3.2, 0.14, 2.4),
        ])!,
      };
    }
  }
}

// Tiny vector helpers over plain [x, y, z] tuples. The design model stays
// serialisable (no class instances), so all geometry works on tuples.
// World units are inches; +Y is up.

export type V3 = [number, number, number];

export const v3 = (x = 0, y = 0, z = 0): V3 => [x, y, z];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const dist = (a: V3, b: V3): number => len(sub(a, b));
export const lerp = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];

export function norm(a: V3): V3 {
  const l = len(a);
  return l < 1e-12 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
}

export const eq = (a: V3, b: V3, tol = 1e-3): boolean => dist(a, b) <= tol;

/** Angle between two direction vectors in degrees, 0..180. */
export function angleDeg(a: V3, b: V3): number {
  const c = dot(norm(a), norm(b));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** Acute angle between two lines (direction sign ignored), 0..90 degrees. */
export function lineAngleDeg(a: V3, b: V3): number {
  const d = angleDeg(a, b);
  return d > 90 ? 180 - d : d;
}

/** Closest point on segment ab to p, returned as parameter t in [0, 1] and distance. */
export function closestOnSegment(p: V3, a: V3, b: V3): { t: number; d: number; point: V3 } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  const point = lerp(a, b, t);
  return { t, d: dist(p, point), point };
}

/**
 * Closest points between segments p1-q1 and p2-q2 (Ericson, Real-Time
 * Collision Detection 5.1.9). Returns params s, t in [0,1] and the distance.
 */
export function segmentSegment(p1: V3, q1: V3, p2: V3, q2: V3): { s: number; t: number; d: number } {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  const EPS = 1e-12;
  let s: number;
  let t: number;
  if (a <= EPS && e <= EPS) {
    s = 0;
    t = 0;
  } else if (a <= EPS) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = dot(d1, r);
    if (e <= EPS) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom > EPS ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  const c1 = add(p1, scale(d1, s));
  const c2 = add(p2, scale(d2, t));
  return { s, t, d: dist(c1, c2) };
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Any unit vector perpendicular to `a`. */
export function anyPerp(a: V3): V3 {
  const n = norm(a);
  const helper: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return norm(cross(n, helper));
}

/** Round every component to the nearest multiple of `step`. */
export function snapV(a: V3, step: number): V3 {
  return [roundTo(a[0], step), roundTo(a[1], step), roundTo(a[2], step)];
}

export function roundTo(x: number, step: number): number {
  const r = Math.round(x / step) * step;
  // Normalise -0 and float fuzz so keys stay stable.
  return Math.abs(r) < 1e-9 ? 0 : Number(r.toFixed(6));
}

/** Stable string key for a point (1/64 in resolution). */
export function pointKey(p: V3): string {
  return p.map((c) => Math.round(c * 64)).join(',');
}

// Pipe drawing: click a start point, move to pick a direction, click to place.
//
// Snapping, in priority order:
//   1. existing pipe ends (joins them)
//   2. where the direction line crosses an existing pipe (makes a T)
//   3. the X / Y / Z axis (and 45° diagonals) nearest the cursor, with the
//      length rounded to the grid step
//   4. a point along a pipe under the cursor (free angle, e.g. a brace)
//   5. the floor grid (free angle, level with the start)
// Typing a length (36, 3'6", 900mm) and pressing Enter places the pipe exactly.

import { Html, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { radius } from '../catalog/emt';
import { formatLength, parseLength } from '../model/units';
import { type V3, add, dist, norm, roundTo, scale, sub } from '../model/vec';
import { useStore } from '../state/store';
import type { SceneColors } from '../ui/theme';

type SnapKind = 'end' | 'cross' | 'axis' | 'pipe' | 'grid';

interface Snap {
  point: V3;
  kind: SnapKind;
  /** Integer direction (components -1..1) when the pipe follows an axis or diagonal. */
  u?: V3;
}

const AXIS_DIRS: V3[] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
const DIAG_DIRS: V3[] = [];
for (const [i, j] of [[0, 1], [0, 2], [1, 2]])
  for (const si of [1, -1])
    for (const sj of [1, -1]) {
      const u: V3 = [0, 0, 0];
      u[i] = si;
      u[j] = sj;
      DIAG_DIRS.push(u);
    }

const END_PX = 12;
const CROSS_PX = 14;
const PIPE_PX = 9;
/** Beyond this angle between cursor and every axis, the pipe follows the cursor freely. */
const AXIS_MAX_DEG = 24;

const v3 = (p: THREE.Vector3): V3 => [p.x, p.y, p.z];
const q = (x: number) => roundTo(x, 1 / 16);

export function axisName(u?: V3): string {
  if (!u) return 'free';
  const nz = u.filter((c) => c !== 0).length;
  if (nz === 1) return u[0] ? 'X' : u[1] ? 'Y' : 'Z';
  return '45°';
}

export function DrawTool({ colors }: { colors: SceneColors }) {
  const { camera, gl } = useThree();
  const tool = useStore((s) => s.tool);
  const snapStep = useStore((s) => s.snap);
  const allow45 = useStore((s) => s.allow45);
  const units = useStore((s) => s.units);
  const pipes = useStore((s) => s.design.pipes);
  const drawSize = useStore((s) => s.drawSize);
  const addPipe = useStore((s) => s.addPipe);
  const setTool = useStore((s) => s.setTool);

  const [start, setStart] = useState<V3 | null>(null);
  const [hover, setHover] = useState<Snap | null>(null);
  const [typed, setTyped] = useState('');
  const downAt = useRef<{ x: number; y: number; button: number } | null>(null);
  const frame = useRef(0);
  // Latest values for the DOM listeners, which are attached once per mode.
  const startRef = useRef<V3 | null>(null);
  startRef.current = start;
  const hoverRef = useRef<Snap | null>(null);
  hoverRef.current = hover;
  const typedRef = useRef('');
  typedRef.current = typed;

  const active = tool === 'draw';
  const ends = useMemo(() => pipes.flatMap((p) => [p.a, p.b]), [pipes]);

  const toScreen = useCallback(
    (p: V3): [number, number] => {
      const rect = gl.domElement.getBoundingClientRect();
      const v = new THREE.Vector3(...p).project(camera);
      return [((v.x + 1) / 2) * rect.width, ((1 - v.y) / 2) * rect.height];
    },
    [camera, gl],
  );

  const compute = useCallback(
    (clientX: number, clientY: number, from: V3 | null): Snap | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const ndc = new THREE.Vector2((mx / rect.width) * 2 - 1, -(my / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const r = ray.ray;
      const px = (p: V3) => {
        const [x, y] = toScreen(p);
        return Math.hypot(x - mx, y - my);
      };

      // 1. Existing pipe ends.
      let best: { p: V3; d: number } | null = null;
      for (const e of ends) {
        if (from && dist(e, from) < 1e-3) continue;
        const d = px(e);
        if (d < END_PX && (!best || d < best.d)) best = { p: e, d };
      }
      if (best) return { point: best.p, kind: 'end' };

      /** Point on a pipe body under the cursor, rounded along the pipe to the grid step. */
      const onPipe = (): V3 | null => {
        let hit: { p: V3; d: number } | null = null;
        const onSeg = new THREE.Vector3();
        for (const pipe of pipes) {
          const a = new THREE.Vector3(...pipe.a);
          const b = new THREE.Vector3(...pipe.b);
          r.distanceSqToSegment(a, b, undefined, onSeg);
          const L = a.distanceTo(b);
          const s = Math.min(L - snapStep / 2, Math.max(snapStep / 2, roundTo(onSeg.distanceTo(a), snapStep)));
          if (s <= 0 || s >= L) continue;
          const p = v3(a.clone().add(b.clone().sub(a).setLength(s)));
          const d = px(v3(onSeg));
          if (d < PIPE_PX + radius(pipe.size) && (!hit || d < hit.d)) hit = { p, d };
        }
        return hit ? hit.p.map(q) as V3 : null;
      };

      const ground = (y: number): V3 | null => {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
        const out = new THREE.Vector3();
        if (!r.intersectPlane(plane, out)) return null;
        return [roundTo(out.x, snapStep), q(y), roundTo(out.z, snapStep)];
      };

      if (!from) {
        const p = onPipe();
        if (p) return { point: p, kind: 'pipe' };
        const g = ground(0);
        return g ? { point: g, kind: 'grid' } : null;
      }

      // 3. Axis inference from the start point: the axis whose on-screen
      // direction best matches the cursor's direction from the start.
      const dirs = allow45 ? AXIS_DIRS.concat(DIAG_DIRS) : AXIS_DIRS;
      let axis: { u: V3; t: number; d: number } | null = null;
      const o = r.origin;
      const rd = r.direction;
      const [sx, sy] = toScreen(from);
      const vx = mx - sx;
      const vy = my - sy;
      const vlen = Math.hypot(vx, vy);
      if (vlen > 6) {
        for (const u of dirs) {
          // Nothing goes through the floor.
          if (u[1] < 0 && from[1] <= 1e-6) continue;
          const d = norm(u);
          const [ex, ey] = toScreen(add(from, scale(d, 6)));
          const wx = ex - sx;
          const wy = ey - sy;
          const wlen = Math.hypot(wx, wy);
          if (wlen < 1.5) continue; // pointing straight at the camera
          const cos = (vx * wx + vy * wy) / (vlen * wlen);
          let ang = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
          // Prefer X/Y/Z over diagonals: a diagonal must be clearly closer to win.
          if (u.filter((c) => c !== 0).length > 1) ang += 10;
          if (axis && ang >= axis.d) continue;
          // Length: closest point on the axis line to the cursor ray.
          const w0: V3 = [from[0] - o.x, from[1] - o.y, from[2] - o.z];
          const b = d[0] * rd.x + d[1] * rd.y + d[2] * rd.z;
          const denom = 1 - b * b;
          if (denom < 1e-4) continue;
          const dd = d[0] * w0[0] + d[1] * w0[1] + d[2] * w0[2];
          const e = rd.x * w0[0] + rd.y * w0[1] + rd.z * w0[2];
          const t = (b * e - dd) / denom;
          if (t <= 0.05) continue;
          axis = { u, t, d: ang };
        }
      }

      if (axis && axis.d < AXIS_MAX_DEG) {
        const d = norm(axis.u);
        const unit = Math.hypot(...axis.u);
        const k = Math.max(1, Math.round(axis.t / (snapStep * unit)));
        let point = add(from, scale(axis.u, k * snapStep));
        let kind: SnapKind = 'axis';
        // 2. Where the line meets existing pipes or ends, if the cursor is close.
        const raw = add(from, scale(d, axis.t));
        let crossBest: { p: V3; d: number } | null = null;
        const consider = (p: V3) => {
          const along = (p[0] - from[0]) * d[0] + (p[1] - from[1]) * d[1] + (p[2] - from[2]) * d[2];
          if (along < 0.25) return;
          const off = dist(p, add(from, scale(d, along)));
          if (off > 0.02) return;
          const [ax, ay] = toScreen(p);
          const [bx, by] = toScreen(raw);
          const dpx = Math.hypot(ax - bx, ay - by);
          if (dpx < CROSS_PX && (!crossBest || dpx < crossBest.d)) crossBest = { p, d: dpx };
        };
        for (const e of ends) consider(e);
        for (const pipe of pipes) {
          // Closest approach between the draw line and the pipe segment.
          const a = pipe.a;
          const ab = sub(pipe.b, a);
          const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
          if (L2 < 1e-6) continue;
          const w: V3 = sub(from, a);
          const A = 1;
          const B = d[0] * ab[0] + d[1] * ab[1] + d[2] * ab[2];
          const C = L2;
          const D = d[0] * w[0] + d[1] * w[1] + d[2] * w[2];
          const E = ab[0] * w[0] + ab[1] * w[1] + ab[2] * w[2];
          const den = A * C - B * B;
          if (Math.abs(den) < 1e-9) continue;
          const tt = (A * E - B * D) / den;
          if (tt <= 0 || tt >= 1) continue;
          consider(add(a, scale(ab, tt)).map(q) as V3);
        }
        if (crossBest) {
          point = (crossBest as { p: V3 }).p;
          kind = 'cross';
        }
        return { point: point.map(q) as V3, kind, u: axis.u };
      }

      // 4./5. Free angle: a pipe body under the cursor, else the floor level with the start.
      const p = onPipe();
      if (p && dist(p, from) > 0.5) return { point: p, kind: 'pipe' };
      const g = ground(from[1]);
      if (g && dist(g, from) > 0.5) return { point: g, kind: 'grid' };
      return null;
    },
    [allow45, camera, ends, gl, pipes, snapStep, toScreen],
  );

  if (import.meta.env.DEV) (window as unknown as { pfdDraw: unknown }).pfdDraw = { compute, toScreen, camera };

  // Pointer handling on the canvas element.
  useEffect(() => {
    if (!active) {
      setStart(null);
      setHover(null);
      setTyped('');
      return;
    }
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame.current);
      const { clientX, clientY } = e;
      frame.current = requestAnimationFrame(() => setHover(compute(clientX, clientY, startRef.current)));
    };
    const onDown = (e: PointerEvent) => {
      downAt.current = { x: e.clientX, y: e.clientY, button: e.button };
    };
    const onUp = (e: PointerEvent) => {
      const d = downAt.current;
      downAt.current = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
      if (d.button === 2) {
        setStart(null);
        setTyped('');
        return;
      }
      if (d.button !== 0) return;
      const s = startRef.current;
      const snap = compute(e.clientX, e.clientY, s);
      setHover(snap);
      if (!snap) return;
      if (!s) {
        setStart(snap.point);
        return;
      }
      if (dist(s, snap.point) < 0.5) {
        // Clicking the start point again ends the chain.
        setStart(null);
        return;
      }
      addPipe(s, snap.point);
      setTyped('');
      setStart(snap.point);
    };
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onDbl = () => setStart(null);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('contextmenu', onContext);
    el.addEventListener('dblclick', onDbl);
    return () => {
      cancelAnimationFrame(frame.current);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('contextmenu', onContext);
      el.removeEventListener('dblclick', onDbl);
    };
  }, [active, addPipe, compute, gl]);


  // Typed lengths and Escape.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = startRef.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (typedRef.current) setTyped('');
        else if (s) setStart(null);
        else setTool('select');
        return;
      }
      if (!s) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const h = hoverRef.current;
        const len = parseLength(typedRef.current, units);
        if (len && len > 0.25 && h) {
          const dir = h.u ? norm(h.u) : norm(sub(h.point, s));
          const end = add(s, scale(dir, len)).map(q) as V3;
          addPipe(s, end);
          setStart(end);
        }
        setTyped('');
        return;
      }
      if (e.key === 'Backspace') {
        if (typedRef.current) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setTyped((t) => t.slice(0, -1));
        }
        return;
      }
      if (/^[0-9./'" \-mcft]$/i.test(e.key) && (typedRef.current || /[0-9.]/.test(e.key))) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setTyped((t) => (t + e.key).slice(0, 16));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, addPipe, setTool, units]);

  if (!active) return null;

  const end = start && hover ? hover.point : null;
  const dirColor = (u?: V3) => {
    const n = axisName(u);
    return n === 'X' ? colors.x : n === 'Y' ? colors.y : n === 'Z' ? colors.z : n === '45°' ? colors.diag : colors.accentDeep;
  };
  const markerColor = hover?.kind === 'end' || hover?.kind === 'cross' ? colors.accent : hover?.kind === 'pipe' ? colors.z : colors.gridSection;
  const typedLen = typed ? parseLength(typed, units) : null;
  const previewEnd = start && hover ? (typedLen && typedLen > 0 ? add(start, scale(hover.u ? norm(hover.u) : norm(sub(hover.point, start)), typedLen)) : end) : null;
  const r = radius(drawSize);

  return (
    <group>
      {hover && (
        <mesh position={hover.point} renderOrder={5}>
          <sphereGeometry args={[Math.max(0.55, r * 1.1), 18, 12]} />
          <meshBasicMaterial color={markerColor} transparent opacity={0.85} depthTest={false} />
        </mesh>
      )}
      {start && (
        <mesh position={start} renderOrder={5}>
          <sphereGeometry args={[Math.max(0.5, r), 18, 12]} />
          <meshBasicMaterial color={colors.accent} depthTest={false} />
        </mesh>
      )}
      {start && previewEnd && dist(start, previewEnd) > 0.1 && (
        <>
          <PreviewPipe a={start} b={previewEnd} r={r} color={dirColor(hover?.u)} />
          <Line points={[start, previewEnd]} color={dirColor(hover?.u)} lineWidth={2} depthTest={false} renderOrder={4} />
          {hover?.u && (
            <Line
              points={[previewEnd, add(previewEnd, scale(norm(hover.u), 36))]}
              color={dirColor(hover.u)}
              lineWidth={1}
              dashed
              dashSize={2}
              gapSize={2}
              transparent
              opacity={0.6}
            />
          )}
          <Html position={scale(add(start, previewEnd), 0.5)} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
            <div className="draw-readout">
              <span className="axis" style={{ color: dirColor(hover?.u) }}>
                {axisName(hover?.u)}
              </span>
              {typed ? (
                <span className="typed">
                  {typed}
                  <i>⏎</i>
                </span>
              ) : (
                <span>{formatLength(dist(start, previewEnd), units, { feet: false })}</span>
              )}
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

function PreviewPipe({ a, b, r, color }: { a: V3; b: V3; r: number; color: string }) {
  const mid = scale(add(a, b), 0.5);
  const dir = sub(b, a);
  const len = Math.hypot(...dir);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...norm(dir)));
  return (
    <mesh position={mid} quaternion={quat} renderOrder={3}>
      <cylinderGeometry args={[r, r, len, 20, 1]} />
      <meshStandardMaterial color={color} transparent opacity={0.45} depthWrite={false} />
    </mesh>
  );
}

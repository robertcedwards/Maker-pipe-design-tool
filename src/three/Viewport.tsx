import { CameraControls, ContactShadows, Environment, Grid, Lightformer, TransformControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { bounds } from '../model/analyze';
import type { Design } from '../model/types';
import { type V3, add, roundTo, scale } from '../model/vec';
import { useDerived } from '../state/derived';
import { type ViewName, useStore } from '../state/store';
import { SCENE_DARK, SCENE_LIGHT, type SceneColors, useIsDark } from '../ui/theme';
import { DrawTool } from './DrawTool';
import { LabelProjector } from './LabelProjector';
import { Scene } from './Scene';

const VIEWS: Record<ViewName, [number, number]> = {
  iso: [Math.PI / 4, 0.98],
  top: [0, 0.0001],
  front: [0, Math.PI / 2],
  side: [Math.PI / 2, Math.PI / 2],
};

function CameraRig() {
  const ref = useRef<CameraControls>(null);
  const request = useStore((s) => s.frameRequest);
  const { analysis } = useDerived();
  const analysisRef = useRef(analysis);
  analysisRef.current = analysis;

  useEffect(() => {
    const cc = ref.current;
    if (!cc) return;
    const box = new THREE.Box3();
    if (request.points?.length) {
      for (const p of request.points) box.expandByPoint(new THREE.Vector3(...p));
      box.expandByScalar(6);
    } else {
      const b = bounds(analysisRef.current);
      if (b) box.set(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max));
      else box.set(new THREE.Vector3(-24, 0, -24), new THREE.Vector3(24, 36, 24));
    }
    if (![box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite)) return;
    const smooth = request.n > 1;
    // fitToBox would snap the camera to the nearest axis, so fit a sphere and keep the angle.
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    sphere.radius *= 0.95;
    if (request.view) {
      const [az, polar] = VIEWS[request.view];
      void cc.rotateTo(az, polar, smooth);
    }
    void cc.fitToSphere(sphere, smooth);
  }, [request]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={4}
      maxDistance={4000}
      dollyToCursor
      smoothTime={0.2}
    />
  );
}

/** Translate gizmo for the selected pipes. */
function MoveGizmo() {
  const selection = useStore((s) => s.selection);
  const tool = useStore((s) => s.tool);
  const tab = useStore((s) => s.tab);
  const snap = useStore((s) => s.snap);
  const design = useStore((s) => s.design);
  const pivot = useRef<THREE.Group>(null!);
  const drag = useRef<{ from: V3; base: Design } | null>(null);

  const centroid = useMemo((): V3 | null => {
    const ps = design.pipes.filter((p) => selection.includes(p.id));
    if (!ps.length) return null;
    let c: V3 = [0, 0, 0];
    for (const p of ps) c = add(c, scale(add(p.a, p.b), 0.5));
    return scale(c, 1 / ps.length);
  }, [design, selection]);

  useEffect(() => {
    if (centroid && pivot.current && !drag.current) pivot.current.position.set(...centroid);
  }, [centroid]);

  const visible = tool === 'select' && tab !== 'build' && centroid !== null;
  return (
    <>
      <group ref={pivot} />
      {visible && (
        <TransformControls
          object={pivot}
          mode="translate"
          size={0.75}
          onMouseDown={() => {
            const s = useStore.getState();
            s.beginTransient();
            drag.current = { from: centroid!, base: s.design };
          }}
          onObjectChange={() => {
            const d = drag.current;
            if (!d || !pivot.current) return;
            // The gizmo moves smoothly; the pipes move in whole snap steps from where they started.
            const p = pivot.current.position;
            const delta: V3 = [roundTo(p.x - d.from[0], snap), roundTo(p.y - d.from[1], snap), roundTo(p.z - d.from[2], snap)].map((x) =>
              roundTo(x, 1 / 16),
            ) as V3;
            const ids = new Set(useStore.getState().selection);
            useStore.getState().transient({
              ...d.base,
              pipes: d.base.pipes.map((x) => (ids.has(x.id) ? { ...x, a: add(x.a, delta), b: add(x.b, delta) } : x)),
            });
          }}
          onMouseUp={() => {
            const d = drag.current;
            drag.current = null;
            // Park the gizmo on the snapped result rather than where the mouse let go.
            if (!d || !pivot.current) return;
            const { design: now, selection: sel } = useStore.getState();
            const ps = now.pipes.filter((x) => sel.includes(x.id));
            if (!ps.length) return;
            let c: V3 = [0, 0, 0];
            for (const x of ps) c = add(c, scale(add(x.a, x.b), 0.5));
            pivot.current.position.set(...scale(c, 1 / ps.length));
          }}
        />
      )}
    </>
  );
}

function Lights({ colors, dark }: { colors: SceneColors; dark: boolean }) {
  return (
    <>
      <color attach="background" args={[colors.background]} />
      <hemisphereLight args={[dark ? '#b8c4cc' : '#ffffff', dark ? '#1a1f22' : '#8d9596', dark ? 0.55 : 0.8]} />
      <directionalLight
        position={[120, 220, 160]}
        intensity={dark ? 1.4 : 1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
        shadow-camera-far={800}
        shadow-bias={-0.0004}
      />
      <Environment resolution={256} frames={1}>
        {/* A light surround so vertical metal reflects shop light, not black. */}
        <color attach="background" args={[dark ? '#20272a' : '#9aa3a6']} />
        <Lightformer form="rect" intensity={2.2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-6, 2, 3]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[6, 2, -3]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="ring" color={dark ? '#ffd46b' : '#fff1c4'} intensity={0.8} position={[0, 3, -8]} scale={3} />
      </Environment>
    </>
  );
}

function Floor({ colors }: { colors: SceneColors }) {
  const snap = useStore((s) => s.snap);
  const { analysis } = useDerived();
  const b = bounds(analysis);
  const floorY = Math.min(0, (b?.min[1] ?? 0) - 0.15);
  const cell = snap >= 1 ? snap : 1;
  return (
    <>
      <Grid
        position={[0, floorY - 0.02, 0]}
        args={[10, 10]}
        cellSize={cell}
        cellThickness={0.6}
        cellColor={colors.grid}
        sectionSize={12}
        sectionThickness={1.1}
        sectionColor={colors.gridSection}
        fadeDistance={900}
        fadeStrength={1.6}
        infiniteGrid
        followCamera={false}
      />
      <ContactShadows
        key={analysis.connectors.length + ':' + Object.keys(analysis.pipes).length + ':' + (b ? b.size.join(',') : '')}
        position={[b ? (b.min[0] + b.max[0]) / 2 : 0, floorY, b ? (b.min[2] + b.max[2]) / 2 : 0]}
        scale={b ? Math.max(b.size[0], b.size[2]) * 1.6 + 40 : 120}
        far={b ? b.size[1] + 10 : 60}
        blur={2.4}
        opacity={0.45}
        resolution={512}
        frames={1}
      />
    </>
  );
}

export function Viewport() {
  const dark = useIsDark();
  const colors = dark ? SCENE_DARK : SCENE_LIGHT;
  const tool = useStore((s) => s.tool);
  const select = useStore((s) => s.select);
  const down = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className={`viewport tool-${tool}`}
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [90, 70, 110], fov: 38, near: 0.5, far: 20000 }}
        gl={{ antialias: true }}
        onPointerMissed={(e) => {
          const d = down.current;
          if (tool !== 'select' || !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
          select([]);
        }}
      >
        <Lights colors={colors} dark={dark} />
        <Floor colors={colors} />
        <Scene colors={colors} />
        <DrawTool colors={colors} />
        <MoveGizmo />
        <CameraRig />
        <LabelProjector />
      </Canvas>
    </div>
  );
}

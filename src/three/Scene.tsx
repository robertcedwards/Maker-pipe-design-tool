import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { PlacedConnector } from '../model/analyze';
import { visibleAt } from '../model/instructions';
import { useDerived } from '../state/derived';
import { useStore } from '../state/store';
import type { SceneColors } from '../ui/theme';
import { type ConnectorMesh, connectorGeometry, fittingGeometry, pipeGeometry, pipeTransform } from './geometry';

type Look = 'normal' | 'selected' | 'hover' | 'error' | 'past' | 'current' | 'ghost';

function useMaterials(colors: SceneColors, finish: 'silver' | 'black') {
  return useMemo(() => {
    const metal = (color: string, metalness: number, roughness: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
    const ghost = new THREE.MeshBasicMaterial({ color: colors.ghost, transparent: true, opacity: 0.1, depthWrite: false });
    const connectorBase = finish === 'black' ? metal(colors.black, 0.45, 0.5) : metal(colors.zinc, 0.9, 0.34);
    return {
      pipe: {
        normal: metal(colors.pipe, 0.85, 0.3),
        selected: metal(colors.accent, 0.35, 0.45, { emissive: colors.accent, emissiveIntensity: 0.18 }),
        hover: metal(colors.pipe, 0.6, 0.3, { emissive: colors.accent, emissiveIntensity: 0.12 }),
        error: metal(colors.error, 0.5, 0.45, { emissive: colors.error, emissiveIntensity: 0.15 }),
        past: metal(colors.pipePast, 0.7, 0.45),
        current: metal(colors.accent, 0.35, 0.45, { emissive: colors.accent, emissiveIntensity: 0.18 }),
        ghost,
      } satisfies Record<Look, THREE.Material>,
      connector: {
        normal: connectorBase,
        selected: metal(colors.accent, 0.4, 0.45, { emissive: colors.accent, emissiveIntensity: 0.25 }),
        hover: metal(finish === 'black' ? '#3d4247' : '#c9cfd3', 0.8, 0.3, { emissive: colors.accent, emissiveIntensity: 0.15 }),
        error: metal(colors.error, 0.5, 0.45),
        past: connectorBase,
        current: metal(colors.accentDeep, 0.5, 0.4, { emissive: colors.accent, emissiveIntensity: 0.2 }),
        ghost,
      } satisfies Record<Look, THREE.Material>,
      bolt: finish === 'black' ? metal('#3a3e42', 0.6, 0.45) : metal(colors.bolt, 0.95, 0.3),
      rubber: metal(colors.rubber, 0.05, 0.85),
      fittingMetal: connectorBase,
      marker: new THREE.MeshBasicMaterial({ color: colors.error, transparent: true, opacity: 0.3, depthWrite: false }),
      warnMarker: new THREE.MeshBasicMaterial({ color: '#d99a1e', transparent: true, opacity: 0.3, depthWrite: false }),
    };
  }, [colors, finish]);
}

/** Connector geometry cache keyed by shape, so unchanged connectors are not rebuilt on every edit. */
const connectorCache = new Map<string, ConnectorMesh>();
const connectorKey = (c: PlacedConnector) =>
  [c.kind, c.size, c.pos.map((x) => x.toFixed(3)), c.axis.map((x) => x.toFixed(4)), c.arms.map((a) => `${a.dir.map((x) => x.toFixed(4))}:${a.setback.toFixed(3)}`)].join('|');

export function Scene({ colors }: { colors: SceneColors }) {
  const { design, analysis, steps } = useDerived();
  const selection = useStore((s) => s.selection);
  const selectedJoint = useStore((s) => s.selectedJoint);
  const tool = useStore((s) => s.tool);
  const tab = useStore((s) => s.tab);
  const stepIndex = useStore((s) => s.step);
  const select = useStore((s) => s.select);
  const selectJoint = useStore((s) => s.selectJoint);
  const mats = useMaterials(colors, design.finish ?? 'silver');
  useEffect(
    () => () => {
      const all = new Set<THREE.Material>([...Object.values(mats.pipe), ...Object.values(mats.connector), mats.bolt, mats.rubber, mats.marker, mats.warnMarker]);
      for (const m of all) m.dispose();
    },
    [mats],
  );
  const [hover, setHover] = useState<string | null>(null);

  const building = tab === 'build' && steps.length > 0;
  const vis = building ? visibleAt(steps, Math.min(stepIndex, steps.length - 1)) : null;
  const current = building ? steps[Math.min(stepIndex, steps.length - 1)] : null;
  const currentPipes = new Set(current?.pipeIds ?? []);
  const currentConnectors = new Set(current?.connectorIds ?? []);
  const currentFittings = new Set(current?.fittingIds ?? []);

  const selected = new Set(selection);
  const errorPipes = useMemo(() => {
    const s = new Set<string>();
    for (const i of analysis.issues) if (i.level === 'error') for (const id of i.pipeIds ?? []) s.add(id);
    return s;
  }, [analysis]);

  const pipeLook = (id: string): Look => {
    if (vis && !vis.all) {
      if (currentPipes.has(id)) return 'current';
      return vis.pipes.has(id) ? 'past' : 'ghost';
    }
    if (selected.has(id)) return 'selected';
    if (hover === id && tool === 'select') return 'hover';
    if (errorPipes.has(id)) return 'error';
    return 'normal';
  };

  const connectorLook = (c: PlacedConnector): Look => {
    if (vis && !vis.all) {
      if (currentConnectors.has(c.id)) return 'current';
      return vis.connectors.has(c.id) ? 'past' : 'ghost';
    }
    if (selectedJoint === c.jointKey) return 'selected';
    if (hover === `j:${c.jointKey}` && tool === 'select') return 'hover';
    return 'normal';
  };

  // Build connector meshes through the cache; drop cache entries no longer used.
  const connectorMeshes = analysis.connectors.map((c) => {
    const key = connectorKey(c);
    let mesh = connectorCache.get(key);
    if (!mesh) {
      mesh = connectorGeometry(c);
      connectorCache.set(key, mesh);
    }
    return { c, key, mesh };
  });
  useEffect(() => {
    const used = new Set(connectorMeshes.map((m) => m.key));
    for (const [key, mesh] of connectorCache) {
      if (!used.has(key) && connectorCache.size > 400) {
        mesh.body.dispose();
        mesh.bolts.dispose();
        connectorCache.delete(key);
      }
    }
  });

  const fittings = useMemo(() => analysis.fittings.map((f) => ({ f, mesh: fittingGeometry(f) })), [analysis]);
  useEffect(
    () => () => {
      for (const { mesh } of fittings) {
        mesh.metal?.dispose();
        mesh.rubber?.dispose();
      }
    },
    [fittings],
  );

  const clickable = tool === 'select' && !building;
  const onPipeClick = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    if (!clickable || e.delta > 4) return;
    e.stopPropagation();
    select([id], e.shiftKey || e.metaKey || e.ctrlKey);
  };
  const onJointClick = (key: string) => (e: ThreeEvent<MouseEvent>) => {
    if (!clickable || e.delta > 4) return;
    e.stopPropagation();
    selectJoint(key);
  };
  const hoverOn = (id: string) => (e: ThreeEvent<PointerEvent>) => {
    if (!clickable) return;
    e.stopPropagation();
    setHover(id);
  };
  const hoverOff = () => setHover(null);

  return (
    <group>
      {design.pipes.map((p) => {
        const info = analysis.pipes[p.id];
        if (!info) return null;
        const { position, quaternion, length } = pipeTransform(info.physA, info.physB);
        const look = pipeLook(p.id);
        return (
          <mesh
            key={p.id}
            geometry={pipeGeometry(p.size)}
            material={mats.pipe[look]}
            position={position}
            quaternion={quaternion}
            scale={[1, length, 1]}
            castShadow={look !== 'ghost'}
            receiveShadow
            onClick={onPipeClick(p.id)}
            onPointerOver={hoverOn(p.id)}
            onPointerOut={hoverOff}
            renderOrder={look === 'ghost' ? 1 : 0}
          />
        );
      })}

      {connectorMeshes.map(({ c, mesh }) => {
        const look = connectorLook(c);
        return (
          <group key={c.id} onClick={onJointClick(c.jointKey)} onPointerOver={hoverOn(`j:${c.jointKey}`)} onPointerOut={hoverOff}>
            <mesh geometry={mesh.body} material={mats.connector[look]} castShadow={look !== 'ghost'} renderOrder={look === 'ghost' ? 1 : 0} />
            {look !== 'ghost' && <mesh geometry={mesh.bolts} material={mats.bolt} />}
          </group>
        );
      })}

      {fittings.map(({ f, mesh }) => {
        // Build view: fittings go on last, so hide them during assembly and tightening.
        if (vis && (!vis.all || current?.kind === 'tighten')) return null;
        const highlight = currentFittings.has(f.id);
        return (
          <group key={f.id}>
            {mesh.metal && <mesh geometry={mesh.metal} material={highlight ? mats.connector.current : mats.fittingMetal} castShadow />}
            {mesh.rubber && <mesh geometry={mesh.rubber} material={highlight ? mats.connector.current : mats.rubber} castShadow />}
          </group>
        );
      })}

      {!building &&
        analysis.issues
          .filter((i) => i.pos && i.level !== 'info')
          .map((i, n) => (
            <mesh key={`issue-${n}`} position={i.pos} material={i.level === 'error' ? mats.marker : mats.warnMarker} renderOrder={2}>
              <sphereGeometry args={[2.2, 20, 14]} />
            </mesh>
          ))}

    </group>
  );
}

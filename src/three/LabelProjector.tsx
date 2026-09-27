import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { labelAnchors, labelElements } from './labels';

/** Positions the overlay labels over their 3D anchor points each frame. */
export function LabelProjector() {
  const { camera, size } = useThree();
  const v = useRef(new THREE.Vector3());
  useFrame(() => {
    for (const [id, el] of labelElements) {
      const a = labelAnchors.get(id);
      if (!a) {
        el.style.visibility = 'hidden';
        continue;
      }
      v.current.set(a[0], a[1], a[2]).project(camera);
      if (v.current.z > 1 || v.current.z < -1) {
        el.style.visibility = 'hidden';
        continue;
      }
      const x = ((v.current.x + 1) / 2) * size.width;
      const y = ((1 - v.current.y) / 2) * size.height;
      el.style.visibility = 'visible';
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -135%)`;
    }
  });
  return null;
}

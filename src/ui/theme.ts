import { useEffect, useState } from 'react';

/**
 * Whether the page is in its dark palette. Follows an explicit
 * data-theme="dark|light" on <html> (set by a host page or the theme menu)
 * and otherwise the operating system preference.
 */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => computeDark());
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => setDark(computeDark());
    mq?.addEventListener?.('change', update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq?.removeEventListener?.('change', update);
      obs.disconnect();
    };
  }, []);
  return dark;
}

function computeDark(): boolean {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

/** Colours used inside the 3D scene, per theme. */
export interface SceneColors {
  background: string;
  grid: string;
  gridSection: string;
  pipe: string;
  pipePast: string;
  zinc: string;
  black: string;
  bolt: string;
  rubber: string;
  accent: string;
  accentDeep: string;
  error: string;
  ghost: string;
  x: string;
  y: string;
  z: string;
  diag: string;
}

export const SCENE_LIGHT: SceneColors = {
  background: '#dfe4e3',
  grid: '#b9c2c1',
  gridSection: '#8d9998',
  pipe: '#c8ced2',
  pipePast: '#9aa3a8',
  zinc: '#b7bec3',
  black: '#2b2e31',
  bolt: '#80878d',
  rubber: '#1c1e20',
  accent: '#f2b705',
  accentDeep: '#c98f00',
  error: '#d33a2c',
  ghost: '#6b7a80',
  x: '#d9483b',
  y: '#3a9a55',
  z: '#2f6fdb',
  diag: '#8a58c9',
};

export const SCENE_DARK: SceneColors = {
  ...SCENE_LIGHT,
  background: '#151a1c',
  grid: '#2a3336',
  gridSection: '#3f4b4f',
  pipe: '#c3c9cd',
  pipePast: '#6f787d',
  ghost: '#8a9aa0',
  accent: '#ffc61a',
};

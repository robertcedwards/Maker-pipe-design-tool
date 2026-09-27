import { useEffect, useState } from 'react';
import type { EndFitting } from '../model/types';

/** True when the page runs inside another page's frame (downloads and share links may not work there). */
export const EMBEDDED = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

// When the page runs inside the claude.ai artifact viewer, file saves go
// through its `downloads` capability (the viewer confirms each save). In an
// ordinary browser tab a normal download is used.
interface DownloadsNs {
  save(req: { filename: string; data: string }): Promise<{ status: string }>;
}
type HostWindow = Window & { claude?: { use?: (name: string) => Promise<unknown> } };

let downloadsNs: Promise<DownloadsNs | null> | null = null;
function hostDownloads(): Promise<DownloadsNs | null> {
  const use = (window as HostWindow).claude?.use;
  if (!use) return Promise.resolve(null);
  downloadsNs ??= use('downloads').then(
    (ns) => (ns as DownloadsNs | null) ?? null,
    () => null,
  );
  return downloadsNs;
}

/** Whether this view can save files: always in a normal tab, only with the capability when embedded. */
export async function canSaveFiles(): Promise<boolean> {
  if ((await hostDownloads()) !== null) return true;
  return !EMBEDDED;
}

/** Save a text file. Resolves to a message for the viewer, or null when there is nothing to say. */
export async function saveFile(name: string, content: string, type: string): Promise<string | null> {
  const host = await hostDownloads();
  if (host) {
    try {
      await host.save({ filename: name, data: content });
      return null;
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'declined') return null;
      if (code === 'rate_limited') return 'A save is already waiting for your answer.';
      return 'Saving files is not available here. Use Copy instead.';
    }
  }
  downloadFile(name, content, type);
  return null;
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Copy text to the clipboard. Falls back to a hidden textarea when the async API is refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'design';

export const END_LABEL: Record<EndFitting, string> = {
  cap: 'End cap',
  foot: 'Rubber foot',
  caster: 'Caster',
  flange: 'Flange',
  'angle-flange': 'Adjustable angle flange',
  open: 'Open (nothing)',
};

export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

/** True once we know this view can save files (see canSaveFiles). */
export function useCanSaveFiles(): boolean {
  const [ok, setOk] = useState(!EMBEDDED);
  useEffect(() => {
    let live = true;
    void canSaveFiles().then((v) => live && setOk(v));
    return () => {
      live = false;
    };
  }, []);
  return ok;
}

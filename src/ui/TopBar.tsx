import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { designToJson, encodeShare, parseDesign } from '../state/serialize';
import { Icon } from './icons';
import { EMBEDDED, copyText, saveFile, slug, useCanSaveFiles } from './util';

export function BrandMark() {
  // A T Connector seen down its through pipe.
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="12.5" y="2" width="7" height="10" rx="1.2" fill="var(--accent)" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="18" r="9" fill="var(--panel-2)" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="18" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

type ThemeChoice = 'system' | 'light' | 'dark';

/** Theme attribute set by a host page (if any) before this app touched it. */
const HOST_THEME = document.documentElement.getAttribute('data-theme');

function useThemeChoice(): [ThemeChoice, (t: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(() => {
    try {
      return (localStorage.getItem('pfd.theme') as ThemeChoice) || 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    // "System" hands control back to the OS, or to a host page's own choice.
    if (choice !== 'system') document.documentElement.setAttribute('data-theme', choice);
    else if (HOST_THEME) document.documentElement.setAttribute('data-theme', HOST_THEME);
    else document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.setItem('pfd.theme', choice);
    } catch {
      /* ignore */
    }
  }, [choice]);
  return [choice, setChoice];
}

export function TopBar({ onPaste }: { onPaste: () => void }) {
  const design = useStore((s) => s.design);
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const units = useStore((s) => s.units);
  const { undo, redo, setDesignField, setPrefs, setTemplateOpen, loadDesign, notify } = useStore.getState();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useThemeChoice();
  const canSave = useCanSaveFiles();
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(design.name);
  useEffect(() => setName(design.name), [design.name]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const parsed = parseDesign(await f.text());
    if (parsed.ok) loadDesign(parsed.design, `Opened ${f.name}`);
    else notify(parsed.error);
  };

  const commitName = () => {
    const n = name.trim() || 'Untitled frame';
    if (n !== design.name) setDesignField('name', n);
    else setName(n);
  };

  const nextTheme: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };

  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark />
        <div>
          <div className="brand-name">Pipe Frame Designer</div>
          <div className="brand-tag">For Maker Pipe connectors and EMT conduit · independent tool</div>
        </div>
      </div>
      <input
        id="design-name"
        className="design-name"
        aria-label="Design name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <div className="topbar-actions">
        <button className="icon-btn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!past} onClick={undo}>
          <Icon.undo />
        </button>
        <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!future} onClick={redo}>
          <Icon.redo />
        </button>
        <div className="seg" role="group" aria-label="Units">
          <button aria-pressed={units === 'imperial'} onClick={() => setPrefs({ units: 'imperial', snap: 1 })}>
            in
          </button>
          <button aria-pressed={units === 'metric'} onClick={() => setPrefs({ units: 'metric', snap: 10 / 25.4 })}>
            mm
          </button>
        </div>
        <button
          className="icon-btn"
          title={`Theme: ${theme}`}
          aria-label={`Theme: ${theme}. Switch to ${nextTheme[theme]}`}
          onClick={() => setTheme(nextTheme[theme])}
        >
          {theme === 'dark' ? <Icon.moon /> : theme === 'light' ? <Icon.sun /> : <Icon.iso />}
        </button>
        <div className="menu" ref={menuRef}>
          <button className="btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
            <Icon.file /> File
          </button>
          {open && (
            <div className="menu-pop card" role="menu">
              <button role="menuitem" onClick={run(() => setTemplateOpen(true))}>
                <Icon.templates /> New from a template…
              </button>
              <button role="menuitem" onClick={run(() => fileRef.current?.click())}>
                <Icon.upload /> Open design file…
              </button>
              <button role="menuitem" onClick={run(onPaste)}>
                <Icon.clipboard /> Paste design text…
              </button>
              <hr />
              {canSave && (
                <button
                  role="menuitem"
                  onClick={run(async () => {
                    const msg = await saveFile(`${slug(design.name)}.pipeframe.json`, designToJson(design), 'application/json');
                    if (msg) notify(msg);
                  })}
                >
                  <Icon.download /> Save design file
                </button>
              )}
              <button
                role="menuitem"
                onClick={run(async () => notify((await copyText(designToJson(design))) ? 'Design copied as text' : 'Copy failed: your browser blocked the clipboard'))}
              >
                <Icon.copy /> Copy design as text
              </button>
              {!EMBEDDED && (
                <button
                  role="menuitem"
                  onClick={run(async () => {
                    const url = `${location.origin}${location.pathname}#d=${encodeShare(design)}`;
                    notify((await copyText(url)) ? 'Share link copied' : 'Copy failed: your browser blocked the clipboard');
                  })}
                >
                  <Icon.link /> Copy share link
                </button>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
        </div>
      </div>
    </header>
  );
}

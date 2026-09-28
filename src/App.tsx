import { useEffect, useState } from 'react';
import { decodeShare } from './state/serialize';
import { useStore } from './state/store';
import { useDerived } from './state/derived';
import { Viewport } from './three/Viewport';
import { PasteDialog, TemplateDialog, Toast } from './ui/Dialogs';
import { DrawBar, StatusBar, StepNav } from './ui/Hud';
import { LabelLayer } from './ui/LabelLayer';
import { Panel } from './ui/Panel';
import { Rail } from './ui/Rail';
import { TopBar } from './ui/TopBar';
import { isTyping } from './ui/util';
import type { V3 } from './model/vec';

function useShortcuts() {
  const { analysis } = useDerived();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.defaultPrevented) return;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && k === 'd') {
        e.preventDefault();
        if (s.selection.length) s.duplicate(s.selection);
        return;
      }
      if (mod && k === 'a') {
        e.preventDefault();
        s.select(s.design.pipes.map((p) => p.id));
        return;
      }
      if (mod || e.altKey) return;
      if (k === 'v') s.setTool('select');
      else if (k === 'p') s.setTool('draw');
      else if (k === 't') s.setTemplateOpen(true);
      else if (k === 'l') s.setPrefs({ showLabels: !s.showLabels });
      else if (k === 'f') {
        const pts: V3[] = [];
        for (const id of s.selection) {
          const i = analysis.pipes[id];
          if (i) pts.push(i.physA, i.physB);
        }
        s.frame(pts.length ? pts : null);
      } else if (k === '1') s.frame(null, 'iso');
      else if (k === '2') s.frame(null, 'top');
      else if (k === '3') s.frame(null, 'front');
      else if (k === '4') s.frame(null, 'side');
      else if (k === 'escape') {
        if (s.selection.length || s.selectedJoint) s.select([]);
        else if (s.tool !== 'select') s.setTool('select');
      } else if ((k === 'delete' || k === 'backspace') && s.selection.length) {
        e.preventDefault();
        s.deletePipes(s.selection);
      } else if (s.selection.length && k.startsWith('arrow') && s.tool === 'select') {
        e.preventDefault();
        const d = s.snap;
        const delta: V3 =
          k === 'arrowleft' ? [-d, 0, 0] : k === 'arrowright' ? [d, 0, 0] : k === 'arrowup' ? (e.shiftKey ? [0, d, 0] : [0, 0, -d]) : e.shiftKey ? [0, -d, 0] : [0, 0, d];
        s.moveSelection(delta);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [analysis]);
}

export default function App() {
  const [pasteOpen, setPasteOpen] = useState(false);
  useShortcuts();

  // Open a design from a share link (#d=...), then frame the model once.
  useEffect(() => {
    const m = location.hash.match(/^#d=([\w-]+)/);
    if (m) {
      const r = decodeShare(m[1]);
      if (r.ok) useStore.getState().loadDesign(r.design, 'Opened shared design');
      else useStore.getState().notify(r.error);
      history.replaceState(null, '', location.pathname + location.search);
    }
    useStore.getState().frame(null, 'iso');
  }, []);

  return (
    <div className="app">
      <TopBar onPaste={() => setPasteOpen(true)} />
      <main className="main">
        <Rail />
        <div className="stage">
          <Viewport />
          <LabelLayer />
          <div className="hud hud-top">
            <DrawBar />
          </div>
          <div className="hud hud-bottom">
            <StatusBar />
            <StepNav />
          </div>
        </div>
        <Panel />
      </main>
      <TemplateDialog />
      <PasteDialog open={pasteOpen} onClose={() => setPasteOpen(false)} />
      <Toast />
    </div>
  );
}

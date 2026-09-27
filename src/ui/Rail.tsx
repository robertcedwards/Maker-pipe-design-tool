import { useStore } from '../state/store';
import { Icon } from './icons';

export function Rail() {
  const tool = useStore((s) => s.tool);
  const showLabels = useStore((s) => s.showLabels);
  const { setTool, setTemplateOpen, frame, setPrefs } = useStore.getState();
  return (
    <nav className="rail" aria-label="Tools">
      <button className="icon-btn" aria-pressed={tool === 'select'} title="Select and move (V)" aria-label="Select and move" onClick={() => setTool('select')}>
        <Icon.select />
      </button>
      <button className="icon-btn" aria-pressed={tool === 'draw'} title="Draw pipe (P)" aria-label="Draw pipe" onClick={() => setTool('draw')}>
        <Icon.pipe />
      </button>
      <button className="icon-btn" title="Start from a template (T)" aria-label="Start from a template" onClick={() => setTemplateOpen(true)}>
        <Icon.templates />
      </button>
      <hr />
      <span className="rail-label">View</span>
      <button className="icon-btn" title="3D view (1)" aria-label="3D view" onClick={() => frame(null, 'iso')}>
        <Icon.iso />
      </button>
      <button className="icon-btn" title="Top view (2)" aria-label="Top view" onClick={() => frame(null, 'top')}>
        <Icon.top />
      </button>
      <button className="icon-btn" title="Front view (3)" aria-label="Front view" onClick={() => frame(null, 'front')}>
        <Icon.front />
      </button>
      <button className="icon-btn" title="Side view (4)" aria-label="Side view" onClick={() => frame(null, 'side')}>
        <Icon.side />
      </button>
      <button className="icon-btn" title="Fit to screen (F)" aria-label="Fit to screen" onClick={() => frame(null)}>
        <Icon.fit />
      </button>
      <hr />
      <button className="icon-btn" aria-pressed={showLabels} title="Part labels (L)" aria-label="Part labels" onClick={() => setPrefs({ showLabels: !showLabels })}>
        <Icon.tag />
      </button>
    </nav>
  );
}

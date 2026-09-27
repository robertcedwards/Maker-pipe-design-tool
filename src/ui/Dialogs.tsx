import { useEffect, useRef, useState } from 'react';
import { TEMPLATES, templateDefaults } from '../model/templates';
import { PIPE_SIZES, type PipeSize } from '../model/types';
import { MM_PER_IN, formatLength, parseLength } from '../model/units';
import { parseDesign } from '../state/serialize';
import { useStore } from '../state/store';
import { Icon } from './icons';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog card" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="section-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon.close />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TemplateDialog() {
  const open = useStore((s) => s.templateOpen);
  const units = useStore((s) => s.units);
  const { setTemplateOpen, loadTemplate } = useStore.getState();
  const [pick, setPick] = useState(TEMPLATES[0].id);
  const [size, setSize] = useState<PipeSize>('3/4');
  const t = TEMPLATES.find((x) => x.id === pick)!;
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const d = templateDefaults(t);
    setValues(
      Object.fromEntries(
        t.params.map((p) => [p.key, p.kind === 'count' ? String(d[p.key]) : formatLength(d[p.key], units, { feet: false })]),
      ),
    );
  }, [t, units]);

  if (!open) return null;
  const close = () => setTemplateOpen(false);

  const parsed: Record<string, number> = {};
  const errors: string[] = [];
  for (const p of t.params) {
    const raw = values[p.key] ?? '';
    const v = p.kind === 'count' ? Math.round(Number(raw)) : parseLength(raw, units);
    const unit = (x: number) => (p.kind === 'count' ? String(x) : formatLength(x, units, { feet: false }));
    if (v === null || !Number.isFinite(v)) errors.push(`${p.label}: enter a ${p.kind === 'count' ? 'whole number' : 'length'}.`);
    else if (v < p.min || v > p.max) errors.push(`${p.label}: between ${unit(p.min)} and ${unit(p.max)}.`);
    else parsed[p.key] = v;
  }

  return (
    <Modal title="Start from a template" onClose={close}>
      <div className="template-grid" role="group" aria-label="Templates">
        {TEMPLATES.map((x) => (
          <button key={x.id} className="template-card" aria-pressed={x.id === pick} onClick={() => setPick(x.id)}>
            <strong>{x.name}</strong>
            <span>{x.blurb}</span>
          </button>
        ))}
      </div>
      <div className="param-grid">
        {t.params.map((p) => (
          <label key={p.key} htmlFor={`tpl-${p.key}`}>
            {p.label}
            {p.kind === 'length' ? ` (${units === 'metric' ? 'mm' : 'in'})` : ''}
            <input
              id={`tpl-${p.key}`}
              className="input mono"
              value={values[p.key] ?? ''}
              onChange={(e) => setValues({ ...values, [p.key]: e.target.value })}
              inputMode={p.kind === 'count' ? 'numeric' : 'text'}
            />
          </label>
        ))}
        <label>
          Pipe size
          <span className="seg" role="group" aria-label="Pipe size">
            {PIPE_SIZES.map((s) => (
              <button key={s} aria-pressed={size === s} onClick={() => setSize(s)}>
                {s}"
              </button>
            ))}
          </span>
        </label>
      </div>
      {errors.length > 0 && <p className="note" style={{ color: 'var(--error)' }}>{errors.join(' ')}</p>}
      <p className="note">
        Sizes are outside dimensions to pipe centres{units === 'metric' ? ` (1 in = ${MM_PER_IN} mm)` : ''}. Loading a template
        replaces the current frame; Undo brings it back.
      </p>
      <div className="row spread">
        <button
          className="btn"
          onClick={() => {
            loadTemplate('empty', {}, size);
            close();
          }}
        >
          Start empty
        </button>
        <button
          className="btn primary"
          disabled={errors.length > 0}
          onClick={() => {
            loadTemplate(t.id, parsed, size);
            close();
          }}
        >
          Load {t.name.toLowerCase()}
        </button>
      </div>
    </Modal>
  );
}

export function PasteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const loadDesign = useStore((s) => s.loadDesign);
  if (!open) return null;
  return (
    <Modal title="Paste a design" onClose={onClose}>
      <p className="note">Paste text copied with File › Copy design as text, or the contents of a saved design file.</p>
      <textarea
        id="paste-design"
        className="input mono"
        rows={10}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError('');
        }}
        placeholder='{"kind":"pipe-frame-designer", ...}'
      />
      {error && <p className="note" style={{ color: 'var(--error)' }}>{error}</p>}
      <div className="row spread">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!text.trim()}
          onClick={() => {
            const r = parseDesign(text);
            if (!r.ok) return setError(r.error);
            loadDesign(r.design, 'Design loaded');
            setText('');
            onClose();
          }}
        >
          Load design
        </button>
      </div>
    </Modal>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2400);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast || !visible) return null;
  return (
    <div className="toast card" role="status" key={toast.n}>
      {toast.text}
    </div>
  );
}

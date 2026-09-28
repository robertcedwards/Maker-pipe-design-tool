import { create } from 'zustand';
import { DEFAULT_ORDER, type OrderOptions } from '../model/bom';
import { newId } from '../model/ids';
import { TEMPLATES, designFromTemplate, emptyDesign, templateDefaults } from '../model/templates';
import type { Design, EndFitting, JointOverride, Pipe, PipeSize } from '../model/types';
import type { UnitSystem } from '../model/units';
import { type V3, add, dist, lerp, norm, roundTo, scale, sub } from '../model/vec';
import { parseDesign } from './serialize';

export type Tool = 'select' | 'draw';
export type PanelTab = 'design' | 'parts' | 'cut' | 'build' | 'catalog';
export type ViewName = 'iso' | 'top' | 'front' | 'side';

export interface Prefs {
  units: UnitSystem;
  /** Grid / length snap in inches. */
  snap: number;
  drawSize: PipeSize;
  /** Offer 45° directions while drawing. */
  allow45: boolean;
  showLabels: boolean;
  /** Saw kerf in inches, used when packing cuts into sticks. */
  kerf: number;
}

interface State extends Prefs {
  design: Design;
  past: Design[];
  future: Design[];
  tool: Tool;
  selection: string[];
  selectedJoint: string | null;
  tab: PanelTab;
  step: number;
  order: OrderOptions;
  /** Bumped to ask the viewport to frame something. */
  frameRequest: { n: number; points: V3[] | null; view?: ViewName };
  templateOpen: boolean;
  toast: { n: number; text: string } | null;

  commit: (next: Design) => void;
  /** Change the design without adding an undo step (drags). Call beginTransient first. */
  transient: (next: Design) => void;
  beginTransient: () => void;
  undo: () => void;
  redo: () => void;

  addPipe: (a: V3, b: V3) => string | null;
  updatePipes: (ids: string[], patch: Partial<Pick<Pipe, 'size' | 'endA' | 'endB'>>) => void;
  setPipeLength: (id: string, length: number) => void;
  deletePipes: (ids: string[]) => void;
  duplicate: (ids: string[]) => void;
  splitPipe: (id: string) => void;
  moveSelection: (delta: V3) => void;
  setJointOverride: (key: string, patch: JointOverride | null) => void;
  setDesignField: <K extends 'name' | 'defaultEnd' | 'finish' | 'notes'>(key: K, value: Design[K]) => void;
  setExtra: (key: string, qty: number) => void;
  loadDesign: (d: Design, label?: string) => void;
  loadTemplate: (templateId: string, values: Record<string, number>, size: PipeSize) => void;

  setPrefs: (p: Partial<Prefs>) => void;
  setTool: (t: Tool) => void;
  select: (ids: string[], additive?: boolean) => void;
  selectJoint: (key: string | null) => void;
  setTab: (t: PanelTab) => void;
  setStep: (i: number) => void;
  setOrder: (p: Partial<OrderOptions>) => void;
  setPriceOverride: (key: string, value: number | null) => void;
  frame: (points?: V3[] | null, view?: ViewName) => void;
  setTemplateOpen: (open: boolean) => void;
  notify: (text: string) => void;
}

const KEYS = { design: 'pfd.design.v1', prefs: 'pfd.prefs.v1', order: 'pfd.order.v1' };

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

const DEFAULT_PREFS: Prefs = { units: 'imperial', snap: 1, drawSize: '3/4', allow45: true, showLabels: true, kerf: 0.0625 };

function starterDesign(): Design {
  const t = TEMPLATES[0];
  return designFromTemplate(t, templateDefaults(t), '3/4');
}

function initialDesign(): Design {
  const saved = load<unknown>(KEYS.design);
  if (saved) {
    const parsed = parseDesign(saved);
    if (parsed.ok) return parsed.design;
  }
  return starterDesign();
}

const q16 = (x: number) => roundTo(x, 1 / 16);
const q16v = (v: V3): V3 => [q16(v[0]), q16(v[1]), q16(v[2])];
const HISTORY_LIMIT = 100;

export const useStore = create<State>()((set, get) => {
  const prefs = { ...DEFAULT_PREFS, ...(load<Partial<Prefs>>(KEYS.prefs) ?? {}) };
  const order = { ...DEFAULT_ORDER, ...(load<Partial<OrderOptions>>(KEYS.order) ?? {}) };

  const commit = (next: Design) => {
    const { design, past } = get();
    set({ design: next, past: [...past, design].slice(-HISTORY_LIMIT), future: [] });
  };
  const mapPipes = (fn: (p: Pipe) => Pipe | null) => {
    const d = get().design;
    const pipes = d.pipes.map(fn).filter((p): p is Pipe => p !== null);
    commit({ ...d, pipes });
  };

  return {
    ...prefs,
    design: initialDesign(),
    past: [],
    future: [],
    tool: 'select',
    selection: [],
    selectedJoint: null,
    tab: 'design',
    step: 0,
    order,
    frameRequest: { n: 0, points: null },
    templateOpen: false,
    toast: null,

    commit,
    transient: (next) => set({ design: next }),
    beginTransient: () => {
      const { design, past } = get();
      set({ past: [...past, design].slice(-HISTORY_LIMIT), future: [] });
    },
    undo: () => {
      const { past, design, future } = get();
      if (!past.length) return;
      set({ design: past[past.length - 1], past: past.slice(0, -1), future: [design, ...future], selectedJoint: null });
    },
    redo: () => {
      const { past, design, future } = get();
      if (!future.length) return;
      set({ design: future[0], future: future.slice(1), past: [...past, design], selectedJoint: null });
    },

    addPipe: (a, b) => {
      if (dist(a, b) < 0.5) return null;
      const id = newId();
      const d = get().design;
      commit({ ...d, pipes: [...d.pipes, { id, a: q16v(a), b: q16v(b), size: get().drawSize }] });
      return id;
    },
    updatePipes: (ids, patch) => {
      const set_ = new Set(ids);
      mapPipes((p) => (set_.has(p.id) ? { ...p, ...patch } : p));
    },
    setPipeLength: (id, length) => {
      if (!(length > 0.25)) return;
      mapPipes((p) => (p.id === id ? { ...p, b: q16v(add(p.a, scale(norm(sub(p.b, p.a)), length))) } : p));
    },
    deletePipes: (ids) => {
      const set_ = new Set(ids);
      mapPipes((p) => (set_.has(p.id) ? null : p));
      set({ selection: get().selection.filter((id) => !set_.has(id)), selectedJoint: null });
    },
    duplicate: (ids) => {
      const d = get().design;
      const src = d.pipes.filter((p) => ids.includes(p.id));
      if (!src.length) return;
      // Offset the copy beside the originals along X by the selection's width plus a gap.
      const xs = src.flatMap((p) => [p.a[0], p.b[0]]);
      const dx = Math.max(...xs) - Math.min(...xs) + 12;
      const copies = src.map((p) => ({ ...p, id: newId(), a: q16v(add(p.a, [dx, 0, 0])), b: q16v(add(p.b, [dx, 0, 0])) }));
      commit({ ...d, pipes: [...d.pipes, ...copies] });
      set({ selection: copies.map((c) => c.id) });
    },
    splitPipe: (id) => {
      const d = get().design;
      const p = d.pipes.find((x) => x.id === id);
      if (!p) return;
      const snap = get().snap;
      const len = dist(p.a, p.b);
      const t = Math.max(snap, roundTo(len / 2, snap)) / len;
      if (t <= 0 || t >= 1) return;
      const mid = q16v(lerp(p.a, p.b, t));
      const first: Pipe = { ...p, b: mid, endB: undefined };
      const second: Pipe = { ...p, id: newId(), a: mid, endA: undefined };
      commit({ ...d, pipes: d.pipes.flatMap((x) => (x.id === id ? [first, second] : [x])) });
      set({ selection: [first.id, second.id] });
    },
    moveSelection: (delta) => {
      const ids = new Set(get().selection);
      if (!ids.size) return;
      mapPipes((p) => (ids.has(p.id) ? { ...p, a: q16v(add(p.a, delta)), b: q16v(add(p.b, delta)) } : p));
    },
    setJointOverride: (key, patch) => {
      const d = get().design;
      const joints = { ...d.joints };
      if (patch === null) delete joints[key];
      else joints[key] = { ...joints[key], ...patch };
      commit({ ...d, joints });
    },
    setDesignField: (key, value) => {
      const d = get().design;
      commit({ ...d, [key]: value });
    },
    setExtra: (key, qty) => {
      const d = get().design;
      const extras = { ...(d.extras ?? {}) };
      if (qty > 0) extras[key] = Math.floor(qty);
      else delete extras[key];
      commit({ ...d, extras });
    },
    loadDesign: (next, label) => {
      commit(next);
      set({ selection: [], selectedJoint: null, step: 0 });
      get().frame(null);
      if (label) get().notify(label);
    },
    loadTemplate: (templateId, values, size) => {
      const t = TEMPLATES.find((x) => x.id === templateId);
      const next = t ? designFromTemplate(t, values, size) : emptyDesign();
      // Keep the user's finish and extras when swapping frames.
      const cur = get().design;
      get().loadDesign({ ...next, finish: cur.finish, extras: cur.extras }, t ? `Loaded ${t.name.toLowerCase()}` : 'New empty design');
    },

    setPrefs: (p) => set(p),
    setTool: (tool) => set({ tool, selectedJoint: tool === 'draw' ? null : get().selectedJoint }),
    select: (ids, additive) => {
      if (!additive) return set({ selection: ids, selectedJoint: null });
      const cur = new Set(get().selection);
      for (const id of ids) {
        if (cur.has(id)) cur.delete(id);
        else cur.add(id);
      }
      set({ selection: [...cur], selectedJoint: null });
    },
    selectJoint: (key) => set({ selectedJoint: key, selection: [] }),
    setTab: (tab) => set({ tab }),
    setStep: (step) => set({ step }),
    setOrder: (p) => set({ order: { ...get().order, ...p } }),
    setPriceOverride: (key, value) => {
      const priceOverrides = { ...get().order.priceOverrides };
      if (value === null || !Number.isFinite(value) || value < 0) delete priceOverrides[key];
      else priceOverrides[key] = Math.round(value * 100) / 100;
      set({ order: { ...get().order, priceOverrides } });
    },
    frame: (points = null, view) => set({ frameRequest: { n: get().frameRequest.n + 1, points, view } }),
    setTemplateOpen: (templateOpen) => set({ templateOpen }),
    notify: (text) => set({ toast: { n: (get().toast?.n ?? 0) + 1, text } }),
  };
});

export const endFittingOf = (p: Pipe, end: 'a' | 'b', d: Design): EndFitting => (end === 'a' ? p.endA : p.endB) ?? d.defaultEnd;

// Persist the design and preferences (debounced).
let timer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((s, prev) => {
  if (s.design === prev.design && s.order === prev.order && s.units === prev.units && s.snap === prev.snap && s.drawSize === prev.drawSize && s.allow45 === prev.allow45 && s.showLabels === prev.showLabels && s.kerf === prev.kerf) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    save(KEYS.design, s.design);
    save(KEYS.order, s.order);
    save(KEYS.prefs, { units: s.units, snap: s.snap, drawSize: s.drawSize, allow45: s.allow45, showLabels: s.showLabels, kerf: s.kerf });
  }, 300);
});

import { END_FITTINGS, PIPE_SIZES, type Design, type EndFitting, type JointOverride, type Pipe } from '../model/types';
import { newId } from '../model/ids';

export const FILE_KIND = 'pipe-frame-designer';

type Result = { ok: true; design: Design } | { ok: false; error: string };

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isV3 = (x: unknown): x is [number, number, number] => Array.isArray(x) && x.length === 3 && x.every(isNum);
const isEnd = (x: unknown): x is EndFitting => typeof x === 'string' && (END_FITTINGS as string[]).includes(x);

/** Validate and clean a design from a file, paste or storage. Unknown fields are dropped. */
export function parseDesign(input: unknown): Result {
  let raw = input;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'That is not valid JSON.' };
    }
  }
  if (raw && typeof raw === 'object' && 'design' in raw && (raw as { kind?: unknown }).kind === FILE_KIND) {
    raw = (raw as { design: unknown }).design;
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'No design found in that data.' };
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.pipes)) return { ok: false, error: 'The design has no list of pipes.' };

  const seen = new Set<string>();
  const pipes: Pipe[] = [];
  for (const item of r.pipes) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    if (!isV3(p.a) || !isV3(p.b)) continue;
    const size = PIPE_SIZES.includes(p.size as Pipe['size']) ? (p.size as Pipe['size']) : '3/4';
    let id = typeof p.id === 'string' && p.id ? p.id : newId();
    if (seen.has(id)) id = newId();
    seen.add(id);
    const pipe: Pipe = { id, a: [...p.a], b: [...p.b], size };
    if (isEnd(p.endA)) pipe.endA = p.endA;
    if (isEnd(p.endB)) pipe.endB = p.endB;
    pipes.push(pipe);
  }
  if (r.pipes.length && !pipes.length) return { ok: false, error: 'None of the pipes in that design could be read.' };

  const joints: Record<string, JointOverride> = {};
  if (r.joints && typeof r.joints === 'object') {
    for (const [k, v] of Object.entries(r.joints as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      const j: JointOverride = {};
      if (typeof o.throughPipeId === 'string') j.throughPipeId = o.throughPipeId;
      if (typeof o.preferAdjustable === 'boolean') j.preferAdjustable = o.preferAdjustable;
      joints[k] = j;
    }
  }
  const extras: Record<string, number> = {};
  if (r.extras && typeof r.extras === 'object') {
    for (const [k, v] of Object.entries(r.extras as Record<string, unknown>)) if (isNum(v) && v > 0) extras[k] = Math.floor(v);
  }
  return {
    ok: true,
    design: {
      version: 1,
      name: typeof r.name === 'string' && r.name.trim() ? r.name.slice(0, 80) : 'Imported frame',
      pipes,
      joints,
      defaultEnd: isEnd(r.defaultEnd) ? r.defaultEnd : 'cap',
      finish: r.finish === 'black' ? 'black' : 'silver',
      extras,
      notes: typeof r.notes === 'string' ? r.notes.slice(0, 2000) : undefined,
    },
  };
}

export function designToJson(d: Design): string {
  return JSON.stringify({ kind: FILE_KIND, version: 1, savedAt: new Date().toISOString(), design: d }, null, 2);
}

/** Compact, URL-safe encoding of a design for share links (#d=...). */
export function encodeShare(d: Design): string {
  const compact = { ...d, pipes: d.pipes.map((p) => ({ ...p, a: p.a.map(r4), b: p.b.map(r4) })) };
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(s: string): Result {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return parseDesign(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, error: 'That share link is damaged.' };
  }
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;

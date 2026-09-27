// Length formatting and parsing. The model is stored in inches; the display
// can be imperial (feet-inches with 1/16 in fractions) or metric (mm / cm).

export type UnitSystem = 'imperial' | 'metric';

export const MM_PER_IN = 25.4;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** 50.375 -> `50-3/8"`; rounds to the nearest 1/16 in. */
export function formatInches(inches: number, opts: { feet?: boolean; denom?: number } = {}): string {
  const denom = opts.denom ?? 16;
  const neg = inches < 0;
  let ticks = Math.round(Math.abs(inches) * denom);
  let feet = 0;
  if (opts.feet && ticks >= 12 * denom) {
    feet = Math.floor(ticks / (12 * denom));
    ticks -= feet * 12 * denom;
  }
  const whole = Math.floor(ticks / denom);
  let num = ticks - whole * denom;
  let den = denom;
  if (num > 0) {
    const g = gcd(num, den);
    num /= g;
    den /= g;
  }
  let inchPart: string;
  if (num === 0) inchPart = `${whole}"`;
  else if (whole === 0) inchPart = `${num}/${den}"`;
  else inchPart = `${whole}-${num}/${den}"`;
  const body = feet > 0 ? (whole === 0 && num === 0 ? `${feet}'` : `${feet}' ${inchPart}`) : inchPart;
  return neg ? `-${body}` : body;
}

export function formatLength(inches: number, units: UnitSystem, opts: { feet?: boolean } = {}): string {
  if (units === 'metric') {
    const mm = inches * MM_PER_IN;
    if (Math.abs(mm) >= 1000) return `${(mm / 1000).toFixed(3).replace(/\.?0+$/, '')} m`;
    return `${Math.round(mm)} mm`;
  }
  return formatInches(inches, { feet: opts.feet ?? true });
}

/** Short form used on 3D labels. */
export function formatShort(inches: number, units: UnitSystem): string {
  if (units === 'metric') return `${Math.round(inches * MM_PER_IN)}`;
  return formatInches(inches, { feet: false });
}

/**
 * Parse a typed length into inches. Accepts things like:
 *   36   36"   36in   3'   3' 6"   3'6-1/2"   3ft 6in   42.5   1/2"   5-3/8
 *   900mm   90cm   1.2m
 * A bare number is read in the current unit system (inches or millimetres).
 * Returns null when the text is not a length.
 */
export function parseLength(text: string, units: UnitSystem = 'imperial'): number | null {
  const s = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;

  const metric = s.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|m)$/);
  if (metric) {
    const v = parseFloat(metric[1]);
    const mm = metric[2] === 'mm' ? v : metric[2] === 'cm' ? v * 10 : v * 1000;
    return mm / MM_PER_IN;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    const v = parseFloat(s);
    return units === 'metric' ? v / MM_PER_IN : v;
  }

  // Imperial: optional feet part, optional inches part with fraction.
  const num = String.raw`(\d+(?:\.\d+)?)`;
  const frac = String.raw`(\d+)\s*/\s*(\d+)`;
  const re = new RegExp(
    String.raw`^(?:${num}\s*(?:'|ft|feet|foot))?\s*` +
      String.raw`(?:(?:${num}(?:\s*[- ]\s*${frac})?|${frac})\s*(?:"|in|inch|inches|'')?)?$`,
  );
  const m = s.match(re);
  if (!m) return null;
  const [, ft, whole, fn, fd, onlyN, onlyD] = m;
  if (ft === undefined && whole === undefined && onlyN === undefined) return null;
  let total = 0;
  if (ft !== undefined) total += parseFloat(ft) * 12;
  if (whole !== undefined) total += parseFloat(whole);
  if (fn !== undefined && fd !== undefined) {
    const d = parseInt(fd, 10);
    if (d === 0) return null;
    total += parseInt(fn, 10) / d;
  }
  if (onlyN !== undefined && onlyD !== undefined) {
    const d = parseInt(onlyD, 10);
    if (d === 0) return null;
    total += parseInt(onlyN, 10) / d;
  }
  return total;
}

export function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** Snap steps offered in the UI, in inches. */
export const SNAP_STEPS: Record<UnitSystem, { label: string; inches: number }[]> = {
  imperial: [
    { label: '1/4"', inches: 0.25 },
    { label: '1/2"', inches: 0.5 },
    { label: '1"', inches: 1 },
    { label: '2"', inches: 2 },
    { label: '3"', inches: 3 },
    { label: '6"', inches: 6 },
    { label: '12"', inches: 12 },
  ],
  metric: [
    { label: '5 mm', inches: 5 / MM_PER_IN },
    { label: '10 mm', inches: 10 / MM_PER_IN },
    { label: '25 mm', inches: 25 / MM_PER_IN },
    { label: '50 mm', inches: 50 / MM_PER_IN },
    { label: '100 mm', inches: 100 / MM_PER_IN },
  ],
};

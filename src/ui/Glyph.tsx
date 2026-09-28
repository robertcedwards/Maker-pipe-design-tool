// Schematic glyphs for every catalog item. Radial connectors are drawn looking
// down the through pipe (a ring) with their arms around it; the angled ones
// are drawn from the side, with the through pipe running left to right.

import type { ReactNode } from 'react';

const S = { fill: 'currentColor', fillOpacity: 0.14, stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' as const };

function Frame({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <svg className="glyph" viewBox="0 0 32 32" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {children}
    </svg>
  );
}

const Arm = ({ deg }: { deg: number }) => <rect x="12.5" y="1.5" width="7" height="9.5" rx="1" transform={`rotate(${deg} 16 16)`} {...S} />;

function Radial({ arms }: { arms: number[] }) {
  return (
    <>
      {arms.map((a) => (
        <Arm key={a} deg={a} />
      ))}
      <circle cx="16" cy="16" r="7.2" {...S} />
      <circle cx="16" cy="16" r="3.8" fill="none" stroke="currentColor" strokeWidth={1.3} />
    </>
  );
}

const Bar = () => <rect x="1.5" y="21" width="29" height="5.5" rx="1.2" {...S} />;
const Clamp = () => <rect x="10.5" y="19" width="11" height="9.5" rx="1.6" {...S} />;
const Hinge = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r="2.3" fill="currentColor" />;

const GLYPHS: Record<string, () => ReactNode> = {
  t: () => <Radial arms={[90]} />,
  'pro-t': () => (
    <>
      <Radial arms={[90]} />
      <circle cx="26" cy="13.5" r="0.9" fill="currentColor" />
      <circle cx="26" cy="18.5" r="0.9" fill="currentColor" />
    </>
  ),
  'top-rail-t': () => (
    <>
      <Arm deg={90} />
      <circle cx="16" cy="16" r="8.6" {...S} />
      <circle cx="16" cy="16" r="5.2" fill="none" stroke="currentColor" strokeWidth={1.3} />
    </>
  ),
  '90': () => <Radial arms={[0, 90]} />,
  '180': () => <Radial arms={[90, 270]} />,
  '135': () => <Radial arms={[90, 225]} />,
  '4way': () => <Radial arms={[0, 90, 270]} />,
  '5way': () => <Radial arms={[0, 90, 180, 270]} />,
  '45': () => (
    <>
      <rect x="13" y="3" width="6.5" height="17" rx="1" transform="rotate(45 16 22)" {...S} />
      <Bar />
      <Clamp />
    </>
  ),
  adjustable: () => (
    <>
      <rect x="13" y="1.5" width="6.5" height="14" rx="1" transform="rotate(35 16 12)" {...S} />
      <rect x="14" y="11" width="4" height="9" {...S} />
      <Bar />
      <Clamp />
      <Hinge x={16} y={12} />
    </>
  ),
  'adjustable-180': () => (
    <>
      <rect x="13" y="1.5" width="6" height="13" rx="1" transform="rotate(-50 16 12)" {...S} />
      <rect x="13" y="1.5" width="6" height="13" rx="1" transform="rotate(50 16 12)" {...S} />
      <rect x="14" y="11" width="4" height="9" {...S} />
      <Bar />
      <Clamp />
      <Hinge x={16} y={12} />
    </>
  ),
  coupling: () => (
    <>
      <rect x="1.5" y="13.2" width="13.5" height="5.6" rx="1" {...S} />
      <rect x="17" y="13.2" width="13.5" height="5.6" rx="1" {...S} />
      <rect x="9.5" y="10.5" width="13" height="11" rx="1.6" {...S} />
    </>
  ),
  'barrel-hinge': () => (
    <>
      <rect x="13" y="1.5" width="6" height="29" rx="1" {...S} />
      <rect x="11.5" y="9" width="9" height="5" rx="1" {...S} />
      <rect x="11.5" y="18" width="9" height="5" rx="1" {...S} />
    </>
  ),
  flange: () => (
    <>
      <rect x="13.2" y="2" width="5.6" height="22" rx="1" {...S} />
      <rect x="11" y="14" width="10" height="11" rx="1.4" {...S} />
      <rect x="3" y="25" width="26" height="4.5" rx="1" {...S} />
    </>
  ),
  'angle-flange': () => (
    <>
      <rect x="13" y="1" width="6" height="18" rx="1" transform="rotate(30 16 20)" {...S} />
      <Hinge x={16} y={21} />
      <rect x="3" y="25" width="26" height="4.5" rx="1" {...S} />
    </>
  ),
  cap: () => (
    <>
      <rect x="13" y="2" width="6" height="22" rx="1" {...S} />
      <rect x="11.8" y="23" width="8.4" height="4" rx="1.8" fill="currentColor" />
    </>
  ),
  feet: () => (
    <>
      <rect x="13" y="2" width="6" height="18" rx="1" {...S} />
      <rect x="10.5" y="17" width="11" height="11" rx="3" fill="currentColor" />
    </>
  ),
  'caster-kit': () => (
    <>
      <rect x="13" y="1.5" width="6" height="12" rx="1" {...S} />
      <rect x="9" y="13" width="14" height="3" rx="1" {...S} />
      <circle cx="16" cy="23" r="6.5" {...S} />
      <circle cx="16" cy="23" r="1.6" fill="currentColor" />
    </>
  ),
  'caster-insert': () => (
    <>
      <rect x="11" y="3" width="10" height="14" rx="1" {...S} />
      <path d="M16 17v12M13.5 20h5M13.5 23h5M13.5 26h5" stroke="currentColor" strokeWidth={1.4} fill="none" />
    </>
  ),
  'shim-3/4-1/2': () => <Shim />,
  'shim-1-3/4': () => <Shim />,
  'shim-tube': () => <Shim />,
  telescoping: () => (
    <>
      <rect x="10.5" y="12" width="11" height="18" rx="1" {...S} />
      <rect x="13" y="2" width="6" height="14" rx="1" {...S} />
      <path d="M21.5 18h5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  hardware: () => (
    <>
      <path d="M9 7h9l2 3-2 3H9l-2-3z" {...S} />
      <path d="M13.5 13v14M11 16.5h5M11 19.5h5M11 22.5h5" stroke="currentColor" strokeWidth={1.4} fill="none" />
    </>
  ),
  'quick-clamp': () => (
    <>
      <rect x="13" y="12" width="6" height="17" rx="1" {...S} />
      <path d="M16 12 7 4" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      <circle cx="16" cy="12" r="2.6" fill="currentColor" />
    </>
  ),
  inserts: () => (
    <>
      <circle cx="16" cy="16" r="10" {...S} />
      <path d="M16 6v20M6 16h20M9 9l14 14M23 9 9 23" stroke="currentColor" strokeWidth={1.2} />
      <circle cx="16" cy="16" r="3.5" fill="currentColor" />
    </>
  ),
  friction: () => (
    <>
      <rect x="4" y="11" width="24" height="10" rx="5" {...S} />
      <path d="M9 11v10M14 11v10M19 11v10M24 11v10" stroke="currentColor" strokeWidth={1} />
    </>
  ),
  screws: () => (
    <>
      <path d="M11 5h10l-1.5 3h-7z" {...S} />
      <path d="M16 8v18l-2 3M12.5 12l7 2M12.5 16l7 2M12.5 20l7 2" stroke="currentColor" strokeWidth={1.3} fill="none" />
    </>
  ),
  'strap-mount': () => <Strap holes={1} />,
  'strap-1': () => <Strap holes={1} />,
  'strap-2': () => <Strap holes={2} />,
  shrink: () => (
    <>
      <ellipse cx="10" cy="16" rx="5" ry="9" {...S} />
      <path d="M10 7h14M10 25h14" stroke="currentColor" strokeWidth={1.5} />
      <ellipse cx="24" cy="16" rx="5" ry="9" {...S} />
    </>
  ),
  't-handle-short': () => <THandle long={false} />,
  't-handle-long': () => <THandle long />,
  allen: () => <path d="M8 5h14v5M22 10v17" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  cutter: () => (
    <>
      <path d="M6 9a10 10 0 1 1 0 14" {...S} fill="none" strokeWidth={3} />
      <circle cx="20" cy="16" r="3.5" {...S} />
      <path d="M2 16h10" stroke="currentColor" strokeWidth={2} />
    </>
  ),
  'tool-bundle': () => (
    <>
      <rect x="2.5" y="12" width="27" height="10" rx="2" {...S} />
      <path d="M9 12v10M16 12v10M23 12v10M9 12V6M16 12V8" stroke="currentColor" strokeWidth={1.5} />
    </>
  ),
  minis: () => (
    <>
      <rect x="4" y="15" width="24" height="3" rx="1" {...S} />
      <rect x="14.5" y="4" width="3" height="11" rx="1" {...S} />
      <circle cx="16" cy="16.5" r="3.5" {...S} />
    </>
  ),
  emt: () => (
    <>
      <rect x="1.5" y="12.5" width="29" height="7" rx="1.2" {...S} />
      <ellipse cx="3" cy="16" rx="1.4" ry="3.5" fill="none" stroke="currentColor" strokeWidth={1.2} />
      <path d="M11 12.5v7M21 12.5v7" stroke="currentColor" strokeWidth={0.9} strokeDasharray="1.5 1.5" />
    </>
  ),
};

function Shim() {
  return (
    <>
      <path d="M22.5 9.5a9 9 0 1 0 0 13" {...S} fill="none" strokeWidth={4} />
      <circle cx="16" cy="16" r="4" fill="none" stroke="currentColor" strokeWidth={1.2} />
    </>
  );
}

function Strap({ holes }: { holes: number }) {
  return (
    <>
      <path d="M3 22h6a7 7 0 0 1 14 0h6" {...S} fill="none" strokeWidth={3} strokeLinejoin="round" />
      <circle cx="16" cy="22" r="4.5" fill="none" stroke="currentColor" strokeWidth={1.3} />
      {holes >= 1 && <circle cx="5.5" cy="22" r="1" fill="currentColor" />}
      {holes >= 2 && <circle cx="26.5" cy="22" r="1" fill="currentColor" />}
    </>
  );
}

function THandle({ long }: { long: boolean }) {
  return (
    <>
      <rect x="5" y="4" width="22" height="6" rx="3" {...S} />
      <path d={`M16 10v${long ? 19 : 14}`} stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
    </>
  );
}

function BundleBox() {
  return (
    <>
      <path d="M4 10 16 4l12 6v13l-12 6-12-6z" {...S} />
      <path d="M4 10l12 6 12-6M16 16v13" stroke="currentColor" strokeWidth={1.3} fill="none" />
    </>
  );
}

export function Glyph({ id, title }: { id: string; title?: string }) {
  const draw = GLYPHS[id] ?? BundleBox;
  return <Frame title={title}>{draw()}</Frame>;
}

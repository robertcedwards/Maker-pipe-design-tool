import type { ReactNode, SVGProps } from 'react';

const Svg = ({ children, ...rest }: SVGProps<SVGSVGElement> & { children: ReactNode }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);

export const Icon = {
  select: () => (
    <Svg>
      <path d="M5 3.5 15 10l-4.6 1.1L8.2 15.5z" />
    </Svg>
  ),
  pipe: () => (
    <Svg>
      <rect x="2.5" y="8" width="15" height="4" rx="1" />
      <path d="M6 8v4M14 8v4" />
    </Svg>
  ),
  templates: () => (
    <Svg>
      <path d="M4 16V6.5M16 16V6.5M4 6.5h12M4 11h12M4 16h12M10 6.5V16" />
    </Svg>
  ),
  undo: () => (
    <Svg>
      <path d="M7.5 5 4 8.5 7.5 12" />
      <path d="M4.5 8.5h7a4 4 0 0 1 0 8H9" />
    </Svg>
  ),
  redo: () => (
    <Svg>
      <path d="M12.5 5 16 8.5 12.5 12" />
      <path d="M15.5 8.5h-7a4 4 0 0 0 0 8H11" />
    </Svg>
  ),
  trash: () => (
    <Svg>
      <path d="M4 6h12M8 6V4h4v2M6 6l.7 10h6.6L14 6" />
    </Svg>
  ),
  copy: () => (
    <Svg>
      <rect x="7" y="7" width="9" height="9" rx="1.5" />
      <path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" />
    </Svg>
  ),
  split: () => (
    <Svg>
      <path d="M2.5 10h5M12.5 10h5M10 4v12" />
      <path d="M5.5 8v4M14.5 8v4" />
    </Svg>
  ),
  file: () => (
    <Svg>
      <path d="M5 2.5h6.5L15 6v11.5H5z" />
      <path d="M11.5 2.5V6H15" />
    </Svg>
  ),
  download: () => (
    <Svg>
      <path d="M10 3v10M6 9l4 4 4-4M4 16.5h12" />
    </Svg>
  ),
  upload: () => (
    <Svg>
      <path d="M10 13V3M6 7l4-4 4 4M4 16.5h12" />
    </Svg>
  ),
  clipboard: () => (
    <Svg>
      <rect x="4.5" y="4" width="11" height="13" rx="1.5" />
      <path d="M7.5 4V2.8h5V4M7.5 9h5M7.5 12h5" />
    </Svg>
  ),
  link: () => (
    <Svg>
      <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-1 1" />
      <path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l1-1" />
    </Svg>
  ),
  tag: () => (
    <Svg>
      <path d="M3 10.5V4h6.5l7.5 7.5-6.5 6.5z" />
      <circle cx="7" cy="7.5" r="1.2" />
    </Svg>
  ),
  iso: () => (
    <Svg>
      <path d="M10 2.8 16.5 6.5v7L10 17.2 3.5 13.5v-7z" />
      <path d="M3.5 6.5 10 10l6.5-3.5M10 10v7.2" />
    </Svg>
  ),
  top: () => (
    <Svg>
      <rect x="4" y="4" width="12" height="12" rx="1" />
      <path d="M4 10h12M10 4v12" strokeDasharray="1.5 2" />
    </Svg>
  ),
  front: () => (
    <Svg>
      <path d="M4 17V5h12v12M4 11h12" />
    </Svg>
  ),
  side: () => (
    <Svg>
      <path d="M7 17V5h6v12M7 11h6" />
    </Svg>
  ),
  fit: () => (
    <Svg>
      <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
    </Svg>
  ),
  left: () => (
    <Svg>
      <path d="M12 4.5 6.5 10l5.5 5.5" />
    </Svg>
  ),
  right: () => (
    <Svg>
      <path d="M8 4.5 13.5 10 8 15.5" />
    </Svg>
  ),
  plus: () => (
    <Svg>
      <path d="M10 4v12M4 10h12" />
    </Svg>
  ),
  close: () => (
    <Svg>
      <path d="M5 5l10 10M15 5 5 15" />
    </Svg>
  ),
  external: () => (
    <Svg>
      <path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8" />
    </Svg>
  ),
  more: () => (
    <Svg>
      <circle cx="4.5" cy="10" r="0.8" />
      <circle cx="10" cy="10" r="0.8" />
      <circle cx="15.5" cy="10" r="0.8" />
    </Svg>
  ),
  cart: () => (
    <Svg>
      <path d="M2.5 3.5h2l2 9.5h9l1.5-7H6" />
      <circle cx="8" cy="16.3" r="1.1" />
      <circle cx="14.5" cy="16.3" r="1.1" />
    </Svg>
  ),
  select_all: () => (
    <Svg>
      <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
      <rect x="7" y="7" width="6" height="6" />
    </Svg>
  ),
  magnet: () => (
    <Svg>
      <path d="M5 3.5v7a5 5 0 0 0 10 0v-7h-3.5v7a1.5 1.5 0 0 1-3 0v-7z" />
      <path d="M5 7h3.5M11.5 7H15" />
    </Svg>
  ),
  moon: () => (
    <Svg>
      <path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z" />
    </Svg>
  ),
  sun: () => (
    <Svg>
      <circle cx="10" cy="10" r="3.3" />
      <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" />
    </Svg>
  ),
};

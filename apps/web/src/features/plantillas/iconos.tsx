import type { SVGProps } from 'react';

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconLapiz = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
export const IconDuplicar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
export const IconBaja = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </svg>
);
export const IconVolver = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);
export const IconLupa = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
export const IconRayo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M13 2 3 14h9l-1 8 10-12h-9Z" />
  </svg>
);
export const IconImprimir = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

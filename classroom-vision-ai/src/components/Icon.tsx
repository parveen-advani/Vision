import type { CSSProperties } from "react";

const paths = {
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </>
  ),
  "arrow-up-right": <path d="M6 18 18 6M6 6h12v12" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m14 6-6 6 6 6" />,
  "chevron-right": <path d="m10 6 6 6-6 6" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3m-3 0h6" />
    </>
  ),
  "mic-off": (
    <>
      <path d="m3 3 18 18M9 9v3a3 3 0 0 0 5 2M9 5a3 3 0 0 1 6 1v3M5 11a7 7 0 0 0 12 5M19 11a7 7 0 0 1-.4 2M12 18v3m-3 0h6" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="6" width="13" height="13" rx="3" />
      <path d="m16 10 5-3v11l-5-3" />
    </>
  ),
  hand: (
    <>
      <path d="M8 13V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v9c0 4-3 7-7 7-3 0-4-1-6-3l-4-5a2 2 0 0 1 3-2l2 1Z" />
    </>
  ),
  play: <path d="m9 5 11 7-11 7V5Z" />,
  pause: (
    <>
      <path d="M8 5v14M16 5v14" strokeWidth="3" />
    </>
  ),
  send: (
    <>
      <path d="m21 3-7 18-4-7-7-4L21 3Z" />
      <path d="m10 14 5-5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  book: (
    <>
      <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  command: (
    <>
      <path d="M9 7V5a2 2 0 1 0-2 2h10a2 2 0 1 0-2-2v14a2 2 0 1 0 2-2H7a2 2 0 1 0 2 2V7Z" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10" />
    </>
  ),
  expand: (
    <>
      <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
    </>
  ),
  projector: (
    <>
      <rect x="3" y="3" width="18" height="12" rx="2" />
      <path d="M12 15v6m-5 0 5-4 5 4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  reset: (
    <>
      <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />
    </>
  ),
  "rotate-left": (
    <>
      <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
    </>
  ),
  "rotate-right": (
    <>
      <path d="M20 10a8 8 0 1 0-1 8m1-14v6h-6" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  leaf: (
    <>
      <path d="M20 3c-9-1-16 4-16 10a7 7 0 0 0 7 7c6 0 10-7 9-17ZM5 19 16 8" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}

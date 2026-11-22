import type { ReactElement } from 'react';

type IconName =
  | 'chevron' | 'folder' | 'folderOpen' | 'matter' | 'client' | 'star' | 'starOn' | 'plus' | 'search'
  | 'refresh' | 'settings' | 'check' | 'mail' | 'thread' | 'clip' | 'open' | 'close' | 'link' | 'doc'
  | 'spark' | 'clock' | 'pin' | 'back' | 'upload' | 'logout' | 'rule' | 'trash' | 'record';

const PATHS: Record<IconName, ReactElement> = {
  chevron: <path d="M6 4l4 4-4 4" />,
  folder: <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" />,
  folderOpen: <path d="M2 11.5V4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4A1.5 1.5 0 0 1 13.5 6v.5M2 11.5l1.6-4.3A1 1 0 0 1 4.5 6.5h9.2a.8.8 0 0 1 .7 1.1L13 11.8a1.5 1.5 0 0 1-1.4 1.2H3.5A1.5 1.5 0 0 1 2 11.5z" />,
  matter: <><rect x="2.5" y="4.5" width="11" height="8.5" rx="1.5" /><path d="M6 4.5V3.5A1 1 0 0 1 7 2.5h2a1 1 0 0 1 1 1v1M2.5 8h11" /></>,
  client: <><path d="M3 13.5V4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v9.5M10 7h2a1 1 0 0 1 1 1v5.5M2 13.5h12" /><path d="M5.5 5.5h2M5.5 8h2M5.5 10.5h2" /></>,
  star: <path d="M8 2.2l1.75 3.6 3.95.55-2.86 2.8.68 3.95L8 11.2l-3.52 1.9.68-3.95L2.3 6.35l3.95-.55z" />,
  starOn: <path d="M8 2.2l1.75 3.6 3.95.55-2.86 2.8.68 3.95L8 11.2l-3.52 1.9.68-3.95L2.3 6.35l3.95-.55z" fill="currentColor" />,
  plus: <path d="M8 3v10M3 8h10" />,
  search: <><circle cx="7" cy="7" r="4.25" /><path d="M10.2 10.2L13.5 13.5" /></>,
  refresh: <path d="M13 8a5 5 0 1 1-1.46-3.54M13 2.5v3h-3" />,
  settings: <><circle cx="8" cy="8" r="2" /><path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7L3.6 3.6" /></>,
  check: <path d="M3.5 8.5l3 3 6-7" />,
  mail: <><rect x="2" y="3.5" width="12" height="9" rx="1.5" /><path d="M2.5 4.5L8 8.5l5.5-4" /></>,
  thread: <><path d="M3 4.5h7.5a1.5 1.5 0 0 1 1.5 1.5v4.5H5L3 12.5z" /><path d="M6 3h6.5A1.5 1.5 0 0 1 14 4.5V9" /></>,
  clip: <path d="M10.5 5L6 9.5a1.4 1.4 0 0 0 2 2l5-5a2.8 2.8 0 0 0-4-4l-5 5a4.2 4.2 0 0 0 6 6l4-4" />,
  open: <path d="M9.5 2.5h4v4M13.5 2.5L8 8M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  link: <path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 9 3.5l-.7.7M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.7-.7" />,
  doc: <><path d="M4 2.5h5l3 3v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" /><path d="M9 2.5v3h3" /></>,
  spark: <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" />,
  clock: <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></>,
  pin: <path d="M6 2.5h4l-.5 4 2 2v1H4.5v-1l2-2zM8 9.5v4" />,
  back: <path d="M10 4L6 8l4 4" />,
  upload: <path d="M8 11V3M4.5 6.5L8 3l3.5 3.5M3 13h10" />,
  logout: <path d="M6 13.5H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H6M10.5 11l3-3-3-3M13.5 8H6" />,
  rule: <path d="M3 4h10M3 8h6M3 12h4M11 10l1.5 1.5L15 9" />,
  trash: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8.5" />,
  record: <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2.4" fill="currentColor" /></>,
};

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `kf-icon ${className}` : 'kf-icon'}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export type { IconName };

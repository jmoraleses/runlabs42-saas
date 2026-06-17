'use client'

import React from 'react'

type IconProps = { size?: number; className?: string }

function base(size: number, className: string, children: React.ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

export const WsIcon = {
  Cursor: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', <path d="M4 4l7 16 2.5-6.5L20 11 4 4z" />),
  Rect: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', <rect x="5" y="5" width="14" height="14" rx="1.5" />),
  RectDashed: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <rect
        x="5"
        y="5"
        width="14"
        height="14"
        rx="1.5"
        strokeDasharray="3 2"
      />
    )),
  Pencil: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    )),
  Gear: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </>
    )),
  Highlighter: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <path d="m9 11-6 6v3h3l6-6" />
        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
      </>
    )),
  Hand: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V5a2 2 0 0 0-4 0v6M10 9.5V4a2 2 0 0 0-4 0v10a7 7 0 0 0 14 0v-2.5" />
    )),
  LinkPath: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="18" r="2" />
        <path d="M7.5 7.5 16.5 16.5" />
        <path d="M13.5 7.5H18v4.5" />
      </>
    )),
  Image: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10.5" r="1.5" />
        <path d="m21 17-5.5-5.5a2 2 0 0 0-2.8 0L7 17" />
      </>
    )),
  Zoom: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4.2-4.2" />
      </>
    )),
  Palette: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="8.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="6.5" cy="12.5" r="1.5" fill="currentColor" stroke="none" />
        <path d="M12 2a10 10 0 0 0 0 20c2.2 0 2.8-1.7 1.8-3.2-.6-.9-1.2-2.1-.3-3.1 1-1 2.5-.6 3.5.3 1.4 1.2 3.2.6 3.2-1.8A10 10 0 0 0 12 2Z" />
      </>
    )),
  Star: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <path d="m12 2 2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6Z" />
    )),
  Add: ({ size = 20, className }: IconProps) =>
    base(size, className ?? '', <path d="M12 5v14M5 12h14" />),
  ChevronLeft: ({ size = 20, className }: IconProps) =>
    base(size, className ?? '', <path d="m15 18-6-6 6-6" />),
  ChevronRight: ({ size = 20, className }: IconProps) =>
    base(size, className ?? '', <path d="m9 18 6-6-6-6" />),
  ChevronDown: ({ size = 20, className }: IconProps) =>
    base(size, className ?? '', <path d="m6 9 6 6 6-6" />),
  Edit: ({ size = 18, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    )),
  TypeCursor: ({ size = 18, className }: IconProps) =>
    base(size, className ?? '', <path d="M4 7V4h16v3M9 20h6M12 4v16" />),
  Trash: ({ size = 18, className }: IconProps) =>
    base(size, className ?? '', (
      <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    )),
  Light: ({ size = 18, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </>
    )),
  Dark: ({ size = 18, className }: IconProps) =>
    base(size, className ?? '', <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z" />),
  Sparkle: ({ size = 18, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <path d="M12 3 13.5 8.5 19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z" />
        <path d="M5 3.5.75 2.25 2 5l-.75 2.25L5 7l.75-2.25L8 5 5.75 5.75 5 3.5Z" />
      </>
    )),
  Screenshot: ({ size = 14, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M8 11h8M8 15h5" />
      </>
    )),
  Copy: ({ size = 16, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    )),
  Info: ({ size = 14, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </>
    )),
  CommandImage: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10.5" r="1.5" />
        <path d="m21 17-5.5-5.5a2 2 0 0 0-2.8 0L7 17" />
      </>
    )),
  CommandLogo: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    )),
  CommandDiagram: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <path d="M3 3v18h18" />
        <path d="m7 16 4-5 4 3 5-7" />
      </>
    )),
  CommandPlay: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m10 8 6 4-6 4Z" fill="currentColor" stroke="none" />
      </>
    )),
  CommandStore: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
        <path d="M3 9 5 3h14l2 6" />
      </>
    )),
  CommandWeb: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
      </>
    )),
  CommandMarketing: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <path d="m3 11 18-5v12L3 14v-3Z" />
        <path d="M11 13v8" />
      </>
    )),
  CommandA11y: ({ size = 22, className }: IconProps) =>
    base(size, className ?? '', (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    )),
}

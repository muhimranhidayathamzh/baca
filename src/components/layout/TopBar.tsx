import type { ReactNode } from "react";

interface TopBarProps {
  title?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

/**
 * Bar generik di atas tiap halaman (Feed, Search, Saved, Profile).
 * ReaderOverlay (Fase 3) punya header sendiri, tidak memakai ini.
 */
export default function TopBar({ title, leading, trailing }: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-desk-line bg-desk/90 px-4 py-3 backdrop-blur-sm"
      style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        {title && (
          <span className="truncate font-grotesk text-sm font-semibold tracking-wide text-on-d">
            {title}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{trailing}</div>
    </header>
  );
}

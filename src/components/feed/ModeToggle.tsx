"use client";

import { motion } from "framer-motion";
import type { FeedMode } from "@/types";

const MODES: Array<{ value: FeedMode; label: string }> = [
  { value: "fokus", label: "Fokus" },
  { value: "explore", label: "Explore" },
];

/**
 * Toggle Fokus/Explore di header (SPEC.md Bagian 4.2).
 * Penanda aktif memakai shared layout animation, bukan transisi warna biasa.
 */
export default function ModeToggle({
  mode,
  onChange,
}: {
  mode: FeedMode;
  onChange: (mode: FeedMode) => void;
}) {
  return (
    <div className="flex shrink-0 rounded-full border border-desk-line bg-desk-2 p-[3px]">
      {MODES.map((item) => {
        const isActive = item.value === mode;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={isActive}
            className="relative rounded-full px-3 py-1 font-ui text-[12.5px] font-medium"
          >
            {isActive && (
              <motion.span
                layoutId="mode-toggle-pill"
                className="absolute inset-0 rounded-full bg-amber-lo ring-1 ring-amber/40"
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              />
            )}
            <span className={`relative ${isActive ? "text-amber" : "text-on-d2"}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

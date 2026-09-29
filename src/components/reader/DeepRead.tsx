"use client";

import { AnimatePresence, m } from "framer-motion";
import { BookOpen, ChevronDown } from "lucide-react";
import { useState } from "react";

/**
 * Deep read: rangkuman lebih dalam dalam accordion (SPEC.md Bagian 4.3).
 * Buka/tutupnya pakai animasi tinggi, bukan potong mendadak.
 */
/**
 * Estimasi waktu baca teks deep read itu sendiri (±200 kata/menit), dibulatkan
 * ke 10 detik. Dulu memakai estimasi dari abstrak, jadi selalu "1 mnt" padahal
 * yang dibaca di sini hanya 2-3 kalimat.
 */
function readingTime(text: string): string {
  const words = text.trim().split(/\s+/).length;
  const seconds = Math.max(10, Math.round((words / 200) * 6) * 10);
  return seconds < 60 ? `${seconds} detik` : `${Math.round(seconds / 60)} mnt`;
}

export default function DeepRead({ text }: { text: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="border-t border-page-line">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
      >
        <span className="flex items-center gap-1.5 font-ui text-[11.5px] font-semibold uppercase tracking-[0.06em] text-page-ink2">
          <BookOpen size={14} strokeWidth={2} className="text-amber" />
          Deep read
          <span className="font-normal normal-case tracking-normal text-page-ink2">
            · {readingTime(text)}
          </span>
        </span>

        <m.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="text-page-ink2"
        >
          <ChevronDown size={18} strokeWidth={1.75} />
        </m.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <m.div
            key="deep-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-4 font-serif-read text-[15px] leading-[1.72] text-page-ink">
              {text}
            </p>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}

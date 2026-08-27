"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { Bookmark, ChevronDown, ExternalLink, Info, Share2 } from "lucide-react";
import { useEffect } from "react";
import DeepRead from "./DeepRead";
import QuickTake from "./QuickTake";
import Shimmer from "@/components/ui/Shimmer";
import { TOPIC_DOT_COLOR, formatAuthors } from "@/lib/topics";
import type { SummaryState } from "@/hooks/useViewportSummarize";
import type { Paper } from "@/types";

interface ReaderOverlayProps {
  paper: Paper | null;
  state: SummaryState | undefined;
  isSaved: boolean;
  onClose: () => void;
  onToggleSave: (paper: Paper) => void;
}

/** Spring "fisik" — seperti menarik halaman kertas (SPEC.md Bagian 3). */
const SLIDE_SPRING = { type: "spring", damping: 25, stiffness: 300 } as const;

/** Jarak seret ke bawah sebelum reader tertutup. */
const DISMISS_THRESHOLD = 100;

/** Konten baru muncul setelah panel selesai naik, lalu bertahap 80ms. */
const contentVariants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.22, staggerChildren: 0.08 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
} as const;

export default function ReaderOverlay({
  paper,
  state,
  isSaved,
  onClose,
  onToggleSave,
}: ReaderOverlayProps) {
  const dragControls = useDragControls();

  // Kunci scroll halaman di belakang selama reader terbuka.
  useEffect(() => {
    if (!paper) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [paper]);

  // Tutup dengan tombol Escape.
  useEffect(() => {
    if (!paper) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paper, onClose]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > DISMISS_THRESHOLD) onClose();
  }

  async function handleShare() {
    if (!paper) return;
    const title = state?.status === "done" ? state.summary.hook : paper.title;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: paper.url });
      } catch {
        // Dibatalkan user.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(paper.url);
    } catch {
      // Clipboard diblokir.
    }
  }

  const summary = state?.status === "done" ? state.summary : null;
  const authors = paper ? formatAuthors(paper.authors) : null;

  return (
    <AnimatePresence>
      {paper && (
        <>
          {/* Meja gelap meredup jadi latar — dunia mundur, halaman menyala. */}
          <motion.div
            key="reader-scrim"
            className="fixed inset-0 z-[70] bg-desk"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          <motion.div
            key="reader-panel"
            className="fixed inset-x-0 bottom-0 z-[80] flex h-[94dvh] flex-col overflow-hidden rounded-t-[20px] bg-page"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SLIDE_SPRING}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-modal="true"
            aria-label="Ringkasan paper"
          >
            {/*
              Seret hanya dimulai dari header. Kalau seluruh panel bisa
              diseret, gesture-nya berebut dengan scroll isi bacaan.
            */}
            <div
              onPointerDown={(event) => dragControls.start(event)}
              className="shrink-0 cursor-grab touch-none px-5 pb-2 pt-3 active:cursor-grabbing"
            >
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-page-line" aria-hidden="true" />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup"
                  className="-ml-1 p-1 text-page-ink"
                >
                  <ChevronDown size={22} strokeWidth={1.75} />
                </button>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onToggleSave(paper)}
                    aria-label={isSaved ? "Hapus dari tersimpan" : "Simpan paper"}
                    aria-pressed={isSaved}
                    className="p-1 text-page-ink2"
                  >
                    <motion.span
                      className="block"
                      animate={{ scale: isSaved ? 1.12 : 1 }}
                      transition={SLIDE_SPRING}
                    >
                      <Bookmark
                        size={19}
                        strokeWidth={1.75}
                        className={isSaved ? "fill-amber text-amber" : ""}
                      />
                    </motion.span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    aria-label="Bagikan paper"
                    className="p-1 text-page-ink2"
                  >
                    <Share2 size={19} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </div>

            <motion.div
              className="scrollbar-none flex-1 overflow-y-auto px-6 pb-10"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
            >
              {paper.topic && (
                <motion.div variants={itemVariants} className="mb-3 flex items-center gap-2">
                  <span
                    className="size-[7px] shrink-0 rounded-full"
                    style={{ backgroundColor: TOPIC_DOT_COLOR[paper.topic] }}
                    aria-hidden="true"
                  />
                  <span className="font-ui text-[10.5px] font-semibold uppercase tracking-[0.08em] text-page-ink2">
                    {paper.topic}
                  </span>
                </motion.div>
              )}

              <motion.h1
                variants={itemVariants}
                className="font-serif-read text-[23px] font-medium leading-[1.28] tracking-[-0.01em] text-page-ink"
              >
                {paper.title}
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="mb-6 mt-2 font-ui text-[12.5px] leading-relaxed text-page-ink2"
              >
                {[
                  authors,
                  `${paper.citations.toLocaleString("id-ID")} sitasi`,
                  paper.venue,
                  paper.year ? String(paper.year) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </motion.p>

              <motion.div variants={itemVariants}>
                {summary ? (
                  <>
                    <QuickTake items={summary.quick} />
                    <DeepRead text={summary.deep} readingMinutes={paper.readingMinutes} />
                  </>
                ) : state?.status === "error" ? (
                  <p className="mb-7 font-serif-read text-[15px] leading-relaxed text-page-ink2">
                    Ringkasan gagal dimuat. Kamu tetap bisa membuka paper aslinya
                    di bawah.
                  </p>
                ) : (
                  <div className="mb-7 flex flex-col gap-3" aria-label="Memuat ringkasan">
                    <Shimmer className="h-4 w-full !bg-page-line" />
                    <Shimmer className="h-4 w-[88%] !bg-page-line" />
                    <Shimmer className="h-4 w-[70%] !bg-page-line" />
                  </div>
                )}
              </motion.div>

              <motion.a
                variants={itemVariants}
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex items-center justify-center gap-2 rounded-[12px] bg-page-ink px-4 py-3.5 font-ui text-[14.5px] font-medium text-page"
              >
                <ExternalLink size={17} strokeWidth={1.75} />
                Buka paper asli
              </motion.a>

              <motion.p
                variants={itemVariants}
                className="mt-4 flex items-center justify-center gap-1.5 text-center font-ui text-[11.5px] leading-relaxed text-page-ink2/80"
              >
                <Info size={13} strokeWidth={1.75} className="shrink-0" />
                Ringkasan otomatis — selalu cek sumber asli
              </motion.p>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

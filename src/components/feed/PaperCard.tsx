"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Check, Share2 } from "lucide-react";
import { useState } from "react";
import { HookShimmer } from "@/components/ui/Shimmer";
import { TOPIC_DOT_COLOR, formatCardMeta, underlineVariant } from "@/lib/topics";
import type { SummaryState } from "@/hooks/useViewportSummarize";
import type { Paper } from "@/types";

interface PaperCardProps {
  paper: Paper;
  state: SummaryState | undefined;
  isSaved: boolean;
  onOpen: (paper: Paper) => void;
  onToggleSave: (paper: Paper) => void;
}

/** Spring standar app — tidak pernah ease linear (SPEC.md Bagian 3). */
const SPRING = { type: "spring", damping: 25, stiffness: 300 } as const;

/**
 * Render hook dengan garis bawah amber di frasa kunci.
 *
 * `key` dijamin substring persis dari hook oleh lib/summarize.ts, tapi tetap
 * dicek lagi di sini — kalau tidak ketemu, hook ditampilkan polos. Garis bawah
 * di posisi salah lebih merusak daripada tidak ada garis bawah sama sekali.
 */
function HookText({ hook, keyPhrase, paperId }: { hook: string; keyPhrase: string | null; paperId: string }) {
  if (!keyPhrase) return <>{hook}</>;

  const index = hook.indexOf(keyPhrase);
  if (index === -1) return <>{hook}</>;

  return (
    <>
      {hook.slice(0, index)}
      <span className={underlineVariant(paperId)}>{keyPhrase}</span>
      {hook.slice(index + keyPhrase.length)}
    </>
  );
}

export default function PaperCard({
  paper,
  state,
  isSaved,
  onOpen,
  onToggleSave,
}: PaperCardProps) {
  const [justCopied, setJustCopied] = useState(false);

  const isReady = state?.status === "done";
  const summary = isReady ? state.summary : null;

  async function handleShare(event: React.MouseEvent) {
    event.stopPropagation();
    const shareTitle = summary?.hook ?? paper.title;

    // Web Share API kalau tersedia (SPEC.md Bagian 4.8), kalau tidak salin
    // tautannya ke clipboard.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: paper.url });
        return;
      } catch {
        // User membatalkan share — jangan perlakukan sebagai error.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(paper.url);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1600);
    } catch {
      // Clipboard diblokir — tidak ada yang bisa dilakukan, jangan crash.
    }
  }

  return (
    <motion.article
      layout
      whileTap={{ scale: 0.985 }}
      transition={SPRING}
      onClick={() => onOpen(paper)}
      className="cursor-pointer rounded-card border border-desk-line bg-desk-2 p-[18px] transition-colors hover:border-desk-3"
    >
      {/* Titik warna topik + label — bukan badge rame (SPEC.md Bagian 3) */}
      {paper.topic && (
        <div className="mb-3 flex items-center gap-2">
          <span
            className="size-[7px] shrink-0 rounded-full"
            style={{ backgroundColor: TOPIC_DOT_COLOR[paper.topic] }}
            aria-hidden="true"
          />
          <span className="font-ui text-[10.5px] font-semibold uppercase tracking-[0.08em] text-on-d2">
            {paper.topic}
          </span>
        </div>
      )}

      {/*
        Area hook. Tinggi minimum dipesan sejak awal dan shimmer dipasang
        absolut, jadi kartu tidak meloncat saat summary masuk. Keduanya sempat
        tampil bersamaan selama 300ms = crossfade, bukan jump cut.
      */}
      <div className="relative min-h-[3.4rem]">
        <AnimatePresence initial={false}>
          {!isReady && (
            <motion.div
              key="shimmer"
              className="absolute inset-x-0 top-0"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <HookShimmer />
            </motion.div>
          )}
        </AnimatePresence>

        {isReady && (
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="font-grotesk text-[19px] font-medium leading-snug tracking-[-0.01em] text-on-d"
          >
            <HookText
              hook={summary!.hook}
              keyPhrase={summary!.key}
              paperId={paper.id}
            />
          </motion.h2>
        )}
      </div>

      {/* Judul asli paper — italic serif, selalu tampil (tidak menunggu AI) */}
      <p className="mt-2.5 line-clamp-2 font-serif-read text-[13.5px] italic leading-relaxed text-on-d2">
        {paper.title}
      </p>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-ui text-[12px] text-on-d3">
          {formatCardMeta(paper)}
        </span>

        <div className="flex shrink-0 items-center gap-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(paper);
            }}
            aria-label={isSaved ? "Hapus dari tersimpan" : "Simpan paper"}
            aria-pressed={isSaved}
            className="text-on-d3 transition-colors hover:text-on-d2"
          >
            <motion.span
              className="block"
              animate={{ scale: isSaved ? 1.12 : 1 }}
              transition={SPRING}
            >
              <Bookmark
                size={18}
                strokeWidth={1.75}
                className={isSaved ? "fill-amber text-amber" : ""}
              />
            </motion.span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            aria-label="Bagikan paper"
            className="text-on-d3 transition-colors hover:text-on-d2"
          >
            {justCopied ? (
              <Check size={18} strokeWidth={1.75} className="text-amber" />
            ) : (
              <Share2 size={18} strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

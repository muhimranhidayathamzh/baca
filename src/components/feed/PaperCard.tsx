"use client";

import { AnimatePresence, m } from "framer-motion";
import { Share2 } from "lucide-react";
import { memo, useState } from "react";
import HookText from "@/components/ui/HookText";
import SaveIcon from "@/components/ui/SaveIcon";
import { HookShimmer } from "@/components/ui/Shimmer";
import { useToast } from "@/components/ui/Toast";
import { sharePaper, shareToastMessage } from "@/lib/share";
import { TOPIC_DOT_COLOR, formatCardMeta, isNewPaper } from "@/lib/topics";
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
 * Di-memo: setiap ringkasan yang masuk mengubah state daftar, dan tanpa memo
 * SEMUA kartu ikut render ulang — masing-masing dengan animasi `layout` Framer
 * yang mengukur ulang posisinya. Di Lighthouse itu menjadi rangkaian long task
 * 3+ detik saat ringkasan berdatangan (Performance feed turun ke 44-70).
 * Semua props-nya stabil (callback dari useCallback, state per paper tidak
 * berganti identitas), jadi hanya kartu yang ringkasannya berubah yang render.
 */
const PaperCard = memo(function PaperCard({
  paper,
  state,
  isSaved,
  onOpen,
  onToggleSave,
}: PaperCardProps) {
  const toast = useToast();

  const summary = state?.status === "done" ? state.summary : null;
  const failed = state?.status === "error";
  // Area hook berhenti shimmer begitu ada hasil — ringkasan ATAU kegagalan.
  // Dulu kartu yang gagal menampilkan shimmer selamanya.
  const isReady = Boolean(summary) || failed;
  // Tanpa hook sungguhan (paper tanpa abstrak, atau AI gagal), judul asli yang
  // jadi headline kartu.
  const isFallback = failed || Boolean(summary && summary.hook === paper.title);
  // Hook yang sudah ada sejak kartu dipasang (terkirim bersama feed) tampil
  // langsung, tanpa fade — tidak ada "kedatangan" yang perlu dirayakan, dan
  // teks yang sudah ada sejak awal tidak boleh ditahan di opacity 0.
  const [arrivedWithCard] = useState(isReady);

  async function handleShare(event: React.MouseEvent) {
    event.stopPropagation();
    const outcome = await sharePaper(summary?.hook ?? paper.title, paper.url);
    const message = shareToastMessage(outcome);
    if (message) toast.show(message);
  }

  function handleToggleSave(event: React.MouseEvent) {
    event.stopPropagation();
    onToggleSave(paper);
    toast.show(isSaved ? "Dihapus dari tersimpan" : "Disimpan");
  }

  return (
    <m.article
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
            <m.div
              key="shimmer"
              className="absolute inset-x-0 top-0"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <HookShimmer />
            </m.div>
          )}
        </AnimatePresence>

        {isReady && (
          <m.h2
            initial={arrivedWithCard ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={`font-grotesk text-[19px] font-medium leading-snug tracking-[-0.01em] text-on-d ${
              isFallback ? "line-clamp-3" : ""
            }`}
          >
            {summary ? (
              <HookText
                hook={summary.hook}
                keyPhrase={summary.key}
                paperId={paper.id}
                draw="after-interaction"
              />
            ) : (
              paper.title
            )}
          </m.h2>
        )}
      </div>

      {/*
        Judul asli paper — italic serif, tampil sejak awal tanpa menunggu AI.
        Disembunyikan saat ringkasan fallback: di kondisi itu "hook"-nya adalah
        judul asli itu sendiri, dan kartu akan menampilkan judul yang sama dua
        kali berturut-turut.
      */}
      {!isFallback && (
        <p className="mt-2.5 line-clamp-2 font-serif-read text-[13.5px] italic leading-relaxed text-on-d2">
          {paper.title}
        </p>
      )}

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-ui text-[12px] text-on-d3">
          {isNewPaper(paper.year) && (
            <>
              <span className="font-medium text-amber">Baru</span>
              {formatCardMeta(paper) && " · "}
            </>
          )}
          {formatCardMeta(paper)}
        </span>

        <div className="flex shrink-0 items-center gap-4">
          <button
            type="button"
            onClick={handleToggleSave}
            aria-label={isSaved ? "Hapus dari tersimpan" : "Simpan paper"}
            aria-pressed={isSaved}
            className="text-on-d3 transition-colors hover:text-on-d2"
          >
            <SaveIcon saved={isSaved} size={18} />
          </button>

          <button
            type="button"
            onClick={handleShare}
            aria-label="Bagikan paper"
            className="text-on-d3 transition-colors hover:text-on-d2"
          >
            <Share2 size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </m.article>
  );
});

export default PaperCard;

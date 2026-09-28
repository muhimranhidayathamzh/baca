"use client";

import { useCallback, type ReactNode } from "react";
import PaperCard from "./PaperCard";
import ReaderOverlay from "@/components/reader/ReaderOverlay";
import { trackPaperOpened } from "@/lib/analytics";
import { useReadHistory, useSavedPapers } from "@/hooks/usePaperCollections";
import { useReader } from "@/hooks/useReader";
import { useViewportSummarize } from "@/hooks/useViewportSummarize";
import type { Paper } from "@/types";

/**
 * Daftar kartu paper lengkap dengan summarization berbasis viewport, bookmark,
 * riwayat baca, dan reading view.
 *
 * Dipakai bersama Feed, Search, dan Saved — ketiganya menampilkan kartu yang
 * sama dan membuka reader yang sama (SPEC.md 4.4 & 4.5), jadi perilakunya
 * tinggal di satu tempat.
 */
export default function PaperList({
  papers,
  empty,
}: {
  papers: Paper[];
  /** Ditampilkan saat daftar kosong; kalau tidak diisi, tidak ada yang dirender. */
  empty?: ReactNode;
}) {
  const { summaries, getCardRef } = useViewportSummarize();
  const { saved, isSaved, toggleSaved } = useSavedPapers();
  const { markAsRead } = useReadHistory();

  // Paper dihitung "sudah dibaca" saat reading view-nya dibuka — inilah yang
  // membuatnya tidak muncul lagi di feed berikutnya.
  const handleOpened = useCallback(
    (paper: Paper) => {
      markAsRead(paper.id);
      trackPaperOpened();
    },
    [markAsRead],
  );
  const { activePaper, open, close } = useReader(handleOpened);

  if (papers.length === 0) return <>{empty ?? null}</>;

  return (
    <>
      <div className="flex flex-col gap-3.5">
        {papers.map((paper) => (
          <div key={paper.id} ref={getCardRef(paper.id)}>
            <PaperCard
              paper={paper}
              state={summaries[paper.id]}
              isSaved={isSaved(paper.id)}
              onOpen={open}
              onToggleSave={toggleSaved}
            />
          </div>
        ))}
      </div>

      <ReaderOverlay
        paper={activePaper}
        state={activePaper ? summaries[activePaper.id] : undefined}
        isSaved={activePaper ? saved.some((p) => p.id === activePaper.id) : false}
        onClose={close}
        onToggleSave={toggleSaved}
      />
    </>
  );
}

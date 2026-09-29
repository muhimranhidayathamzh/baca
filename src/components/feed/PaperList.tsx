"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import PaperCard from "./PaperCard";
import ReaderOverlay from "@/components/reader/ReaderOverlay";
import { trackPaperOpened } from "@/lib/analytics";
import { useReadHistory, useSavedPapers, useTopicAffinity } from "@/hooks/usePaperCollections";
import { useReader } from "@/hooks/useReader";
import { useViewportSummarize, type SummaryState } from "@/hooks/useViewportSummarize";
import type { Paper, Summary } from "@/types";

const NO_SUMMARIES: Record<string, Summary> = {};

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
  knownSummaries = NO_SUMMARIES,
  empty,
}: {
  papers: Paper[];
  /**
   * Ringkasan yang sudah terkirim bersama feed/search. Kartu-kartu ini
   * langsung tampil dengan hook-nya dan tidak memanggil /api/summarize.
   */
  knownSummaries?: Record<string, Summary>;
  /** Ditampilkan saat daftar kosong; kalau tidak diisi, tidak ada yang dirender. */
  empty?: ReactNode;
}) {
  const { summaries, getCardRef, retry } = useViewportSummarize(knownSummaries);

  // Objek state dibuat sekali per ringkasan (bukan tiap render), supaya
  // PaperCard yang di-memo tidak ikut render ulang tanpa alasan.
  const knownStates = useMemo(() => {
    const states: Record<string, SummaryState> = {};
    for (const [id, summary] of Object.entries(knownSummaries)) {
      states[id] = { status: "done", summary };
    }
    return states;
  }, [knownSummaries]);
  const stateOf = (id: string) => summaries[id] ?? knownStates[id];
  const { saved, isSaved, toggleSaved } = useSavedPapers();
  const { markAsRead } = useReadHistory();
  const { recordOpen } = useTopicAffinity();

  // Paper dihitung "sudah dibaca" saat reading view-nya dibuka — inilah yang
  // membuatnya tidak muncul lagi di feed berikutnya. Topiknya ikut dicatat
  // untuk porsi feed "Untukmu" (lib/affinity.ts).
  const handleOpened = useCallback(
    (paper: Paper) => {
      markAsRead(paper.id);
      recordOpen(paper.topic);
      trackPaperOpened();
    },
    [markAsRead, recordOpen],
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
              state={stateOf(paper.id)}
              isSaved={isSaved(paper.id)}
              onOpen={open}
              onToggleSave={toggleSaved}
            />
          </div>
        ))}
      </div>

      <ReaderOverlay
        paper={activePaper}
        state={activePaper ? stateOf(activePaper.id) : undefined}
        isSaved={activePaper ? saved.some((p) => p.id === activePaper.id) : false}
        onClose={close}
        onToggleSave={toggleSaved}
        onRetry={retry}
      />
    </>
  );
}

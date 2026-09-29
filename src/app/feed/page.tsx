"use client";

import { WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import ModeToggle from "@/components/feed/ModeToggle";
import PaperList from "@/components/feed/PaperList";
import TopicChips from "@/components/feed/TopicChips";
import TopBar from "@/components/layout/TopBar";
import EmptyState from "@/components/ui/EmptyState";
import { HookShimmer } from "@/components/ui/Shimmer";
import { useFeed } from "@/hooks/useFeed";
import { STORAGE_KEYS, useIsHydrated, useLocalStorage } from "@/hooks/useLocalStorage";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useReadHistory, useSavedPapers, useTopicAffinity } from "@/hooks/usePaperCollections";
import { topicWeights } from "@/lib/affinity";
import { FOR_YOU, TOPICS, type FeedChip } from "@/lib/topics";
import type { FeedMode, TopicName } from "@/types";

/** Identitas stabil supaya snapshot localStorage tidak berubah tiap render. */
const EMPTY_TOPICS: TopicName[] = [];

/** Kartu kosong saat batch pertama masih dimuat. */
function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-card border border-desk-line bg-desk-2 p-[18px]">
          <div className="mb-3 h-3 w-20 animate-pulse rounded bg-desk-3" />
          <HookShimmer />
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-desk-3" />
        </div>
      ))}
    </div>
  );
}

export default function FeedPage() {
  // Topik pilihan diisi saat onboarding; kalau kosong, seluruh topik dipakai.
  const { value: savedTopics } = useLocalStorage<TopicName[]>(
    STORAGE_KEYS.topics,
    EMPTY_TOPICS,
  );
  const { value: mode, setValue: setMode } = useLocalStorage<FeedMode>(
    STORAGE_KEYS.mode,
    "fokus",
  );
  const { value: activeChip, setValue: setActiveChip } = useLocalStorage<FeedChip | null>(
    STORAGE_KEYS.activeTopic,
    null,
  );

  const { history } = useReadHistory();
  const { saved } = useSavedPapers();
  const { affinity } = useTopicAffinity();
  const isOnline = useOnlineStatus();

  const topics = useMemo(
    () => (savedTopics.length > 0 ? savedTopics : TOPICS),
    [savedTopics],
  );

  // Chip yang tidak dikenal (mis. topiknya baru dihapus dari Profil) jatuh ke
  // "Untukmu". Logika yang sama ada di lib/feed-preload.ts.
  const chip: FeedChip =
    activeChip && (activeChip === FOR_YOU || topics.includes(activeChip)) ? activeChip : FOR_YOU;

  const streams = useMemo(() => (chip === FOR_YOU ? topics : [chip]), [chip, topics]);
  const weights = useMemo(() => topicWeights(topics, affinity, saved), [topics, affinity, saved]);

  // Tunggu localStorage terbaca sebelum fetch, supaya feed tidak dimuat dua
  // kali (sekali dengan default, sekali dengan preferensi asli).
  const ready = useIsHydrated();

  const { papers, summaries, status, hasMore, loadMore, retry } = useFeed({
    streams,
    weights,
    mode,
    exclude: history,
    enabled: ready,
  });

  // Infinite scroll: sentinel di bawah daftar memicu batch berikutnya.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
    // `papers.length`: pasang ulang observer setiap batch masuk. Kalau batch-nya
    // pendek dan sentinel masih terlihat, observer baru langsung memicu batch
    // berikutnya — observer lama tidak akan menyala lagi karena tidak ada
    // perubahan status "terlihat".
  }, [hasMore, loadMore, papers.length]);

  const isInitialLoading = status === "loading" || !ready;

  return (
    <>
      <TopBar title="baca." trailing={<ModeToggle mode={mode} onChange={setMode} />} />

      <TopicChips topics={topics} active={chip} onChange={setActiveChip} />

      <div className="px-4">
        {isInitialLoading ? (
          <FeedSkeleton />
        ) : status === "error" && papers.length === 0 ? (
          <EmptyState
            icon={isOnline ? undefined : WifiOff}
            title={
              isOnline
                ? "Gagal memuat feed."
                : "Feed butuh koneksi internet."
            }
            hint={
              isOnline
                ? "Bisa jadi gangguan sementara. Coba lagi sebentar lagi."
                : "Paper yang sudah kamu simpan tetap bisa dibaca sekarang."
            }
            action={
              isOnline ? (
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-full border border-desk-line px-4 py-2 font-ui text-[13px] text-on-d"
                >
                  Coba lagi
                </button>
              ) : (
                <Link
                  href="/saved"
                  className="rounded-full border border-desk-line px-4 py-2 font-ui text-[13px] text-on-d"
                >
                  Buka tersimpan
                </Link>
              )
            }
          />
        ) : (
          <PaperList
            papers={papers}
            knownSummaries={summaries}
            empty={
              <EmptyState
                title="Belum ada paper yang cocok."
                hint="Coba topik lain, atau pindah ke mode Explore buat sesuatu yang tak terduga."
              />
            }
          />
        )}

        <div ref={sentinelRef} className="h-px" aria-hidden="true" />

        {status === "loadingMore" && (
          <p className="py-6 text-center font-ui text-[13px] text-on-d3">
            Memuat paper lain…
          </p>
        )}

        {!hasMore && papers.length > 0 && (
          <p className="py-6 text-center font-ui text-[13px] text-on-d3">
            Sudah sampai ujung. Ganti topik atau mode buat paper baru.
          </p>
        )}
      </div>
    </>
  );
}

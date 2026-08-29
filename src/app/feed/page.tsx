"use client";

import { useEffect, useMemo, useRef } from "react";
import ModeToggle from "@/components/feed/ModeToggle";
import PaperList from "@/components/feed/PaperList";
import TopicChips from "@/components/feed/TopicChips";
import TopBar from "@/components/layout/TopBar";
import { HookShimmer } from "@/components/ui/Shimmer";
import { useFeed } from "@/hooks/useFeed";
import { STORAGE_KEYS, useIsHydrated, useLocalStorage } from "@/hooks/useLocalStorage";
import { useReadHistory } from "@/hooks/usePaperCollections";
import { TOPICS } from "@/lib/openalex";
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
  const { value: activeTopic, setValue: setActiveTopic } =
    useLocalStorage<TopicName | null>(STORAGE_KEYS.activeTopic, null);

  const { history } = useReadHistory();

  const topics = useMemo(
    () => (savedTopics.length > 0 ? savedTopics : TOPICS),
    [savedTopics],
  );

  const topic = activeTopic && topics.includes(activeTopic) ? activeTopic : topics[0]!;

  // Tunggu localStorage terbaca sebelum fetch, supaya feed tidak dimuat dua
  // kali (sekali dengan default, sekali dengan preferensi asli).
  const ready = useIsHydrated();

  const { papers, status, hasMore, loadMore, retry } = useFeed({
    topic,
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
  }, [hasMore, loadMore]);

  const isInitialLoading = status === "loading" || !ready;

  return (
    <>
      <TopBar title="baca." trailing={<ModeToggle mode={mode} onChange={setMode} />} />

      <TopicChips topics={topics} active={topic} onChange={setActiveTopic} />

      <div className="px-4">
        {isInitialLoading ? (
          <FeedSkeleton />
        ) : status === "error" && papers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="max-w-xs font-ui text-sm text-on-d2">
              Gagal memuat feed. Cek koneksi kamu, lalu coba lagi.
            </p>
            <button
              type="button"
              onClick={retry}
              className="rounded-full border border-desk-line px-4 py-2 font-ui text-[13px] text-on-d"
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <PaperList
            papers={papers}
            empty={
              <div className="py-16 text-center font-ui text-sm text-on-d2">
                Belum ada paper yang cocok. Coba topik atau mode lain.
              </div>
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

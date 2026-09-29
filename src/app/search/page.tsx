"use client";

import { Search as SearchIcon, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import PaperList from "@/components/feed/PaperList";
import EmptyState from "@/components/ui/EmptyState";
import { HookShimmer } from "@/components/ui/Shimmer";
import { STORAGE_KEYS, useLocalStorage } from "@/hooks/useLocalStorage";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { TOPICS } from "@/lib/topics";
import type { Paper, SearchResponse, Summary, TopicName } from "@/types";

/** Jeda sebelum mengetik dianggap selesai — hemat kuota, hemat rate limit. */
const DEBOUNCE_MS = 450;

/**
 * Contoh pencarian per topik, sengaja ditulis dalam bahasa sehari-hari —
 * menunjukkan bahwa user tidak perlu tahu istilah ilmiah atau bahasa Inggris
 * (query diperluas di server, lihat lib/query-expand.ts).
 */
const EXAMPLES: Record<TopicName, string[]> = {
  Kesehatan: ["puasa intermiten", "kesehatan mental remaja"],
  AI: ["AI buat deteksi kanker", "chatbot di sekolah"],
  Neurosains: ["kenapa susah tidur", "otak dan media sosial"],
  Lingkungan: ["mikroplastik di laut", "pertanian padi"],
  Psikologi: ["kebiasaan menunda", "kecemasan mahasiswa"],
  Ekonomi: ["UMKM digital", "inflasi harga pangan"],
};

/** Contoh dari topik user dulu (bergiliran), baru topik lain, maksimum 6. */
function examplesFor(topics: TopicName[]): string[] {
  const ordered = [...topics, ...TOPICS.filter((t) => !topics.includes(t))];
  const picks: string[] = [];
  for (let round = 0; round < 2; round++) {
    for (const topic of ordered) {
      const example = EXAMPLES[topic][round];
      if (example && picks.length < 6) picks.push(example);
    }
  }
  return picks;
}

const EMPTY_TOPICS: TopicName[] = [];

type Status = "idle" | "loading" | "done" | "error";

interface Result {
  /** Query yang menghasilkan data ini. */
  q: string;
  papers: Paper[];
  nextPage: number | null;
  /** Terjemahan query yang ikut dicari (dari halaman pertama). */
  expandedLabel: string | null;
  /** Ringkasan yang ikut terkirim bersama hasil (sudah ada di cache server). */
  summaries: Record<string, Summary>;
  error: boolean;
}

const EMPTY_PAPERS: Paper[] = [];
const EMPTY_SUMMARIES: Record<string, Summary> = {};
const INITIAL: Result = {
  q: "",
  papers: EMPTY_PAPERS,
  nextPage: null,
  expandedLabel: null,
  summaries: EMPTY_SUMMARIES,
  error: false,
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [result, setResult] = useState<Result>(INITIAL);
  const isOnline = useOnlineStatus();
  const { value: savedTopics } = useLocalStorage<TopicName[]>(STORAGE_KEYS.topics, EMPTY_TOPICS);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);

  // Tunda pencarian sampai user berhenti mengetik.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const runSearch = useCallback(async (q: string, page: number, append: boolean) => {
    if (append && loadingRef.current) return;

    // Query baru membatalkan pencarian sebelumnya yang masih berjalan.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    loadingRef.current = true;

    const requestId = ++requestIdRef.current;

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&page=${page}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as SearchResponse;
      if (requestId !== requestIdRef.current) return;

      setResult((prev) => {
        const base = append && prev.q === q ? prev.papers : EMPTY_PAPERS;
        const seen = new Set(base.map((p) => p.id));
        return {
          q,
          papers: [...base, ...data.papers.filter((p) => !seen.has(p.id))],
          nextPage: data.nextPage,
          expandedLabel: append && prev.q === q ? prev.expandedLabel : data.expandedLabel,
          summaries:
            append && prev.q === q
              ? { ...prev.summaries, ...data.summaries }
              : (data.summaries ?? EMPTY_SUMMARIES),
          error: false,
        };
      });
    } catch {
      if (controller.signal.aborted) return;
      if (requestId !== requestIdRef.current) return;
      setResult({
        q,
        papers: EMPTY_PAPERS,
        nextPage: null,
        expandedLabel: null,
        summaries: EMPTY_SUMMARIES,
        error: true,
      });
    } finally {
      if (requestId === requestIdRef.current) loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!debounced) {
      // Tidak ada setState di sini: input kosong sudah tercermin lewat status
      // yang diturunkan di bawah. Cukup hentikan request yang masih jalan.
      abortRef.current?.abort();
      requestIdRef.current++;
      loadingRef.current = false;
      return;
    }
    // Lihat catatan di useFeed.ts: aturan ini tidak bisa melihat batas async,
    // dan setState di runSearch baru terjadi setelah await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runSearch(debounced, 1, false);
  }, [debounced, runSearch]);

  // Hasil dari query sebelumnya tidak boleh bocor ke query sekarang.
  const isStale = result.q !== debounced;
  const status: Status = !debounced
    ? "idle"
    : isStale
      ? "loading"
      : result.error
        ? "error"
        : "done";
  const papers = !debounced || isStale ? EMPTY_PAPERS : result.papers;
  const nextPage = !debounced || isStale ? null : result.nextPage;
  const expandedLabel = !debounced || isStale ? null : result.expandedLabel;
  const knownSummaries = !debounced || isStale ? EMPTY_SUMMARIES : result.summaries;

  // Muat halaman berikutnya saat sentinel terlihat.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || nextPage === null || status !== "done") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void runSearch(debounced, nextPage, true);
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [nextPage, status, debounced, runSearch]);

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-desk-line bg-desk/90 px-4 py-3 backdrop-blur-sm"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        {/* Halaman ini tidak memakai TopBar (kolom cari menggantikan judul),
            jadi judulnya disediakan khusus untuk pembaca layar. */}
        <h1 className="sr-only">Cari paper</h1>
        <div className="flex items-center gap-2.5 rounded-full border border-desk-line bg-desk-2 px-4 py-2.5 focus-within:border-amber/50">
          <SearchIcon size={17} strokeWidth={1.75} className="shrink-0 text-on-d3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari topik, pertanyaan, atau kata kunci…"
            aria-label="Cari paper"
            className="min-w-0 flex-1 bg-transparent font-ui text-[14px] text-on-d outline-none placeholder:text-on-d3 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Hapus pencarian"
              className="shrink-0 text-on-d3"
            >
              <X size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </header>

      <div className="px-4 pt-3">
        {status === "idle" ? (
          <EmptyState
            title="Cari apa pun yang lagi kamu pikirin."
            hint="Boleh pakai bahasa sehari-hari — paper berbahasa Inggrisnya ikut kami carikan."
            action={
              <div className="flex max-w-[20rem] flex-wrap justify-center gap-2">
                {examplesFor(savedTopics).map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setQuery(example)}
                    className="rounded-full border border-desk-line px-3.5 py-1.5 font-ui text-[13px] text-on-d2 transition-colors hover:border-desk-3 hover:text-on-d"
                  >
                    {example}
                  </button>
                ))}
              </div>
            }
          />
        ) : status === "loading" ? (
          <div className="flex flex-col gap-3.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-card border border-desk-line bg-desk-2 p-[18px]"
              >
                <div className="mb-3 h-3 w-20 animate-pulse rounded bg-desk-3" />
                <HookShimmer />
              </div>
            ))}
          </div>
        ) : status === "error" ? (
          <EmptyState
            icon={isOnline ? undefined : WifiOff}
            title={isOnline ? "Pencarian gagal." : "Pencarian butuh koneksi internet."}
            hint={
              isOnline
                ? "Bisa jadi gangguan sementara. Coba lagi sebentar lagi."
                : "Paper yang sudah kamu simpan tetap bisa dibaca sekarang."
            }
            action={
              isOnline ? (
                <button
                  type="button"
                  onClick={() => void runSearch(debounced, 1, false)}
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
          <>
            {expandedLabel && papers.length > 0 && (
              <p className="mb-3 px-1 font-ui text-[12.5px] leading-relaxed text-on-d3">
                Termasuk paper berbahasa Inggris untuk{" "}
                <span className="text-on-d2">“{expandedLabel}”</span>
              </p>
            )}
            <PaperList
              papers={papers}
              knownSummaries={knownSummaries}
              empty={
                <EmptyState
                  title={`Nggak ada yang cocok buat “${debounced}”.`}
                  hint="Coba kata kunci yang lebih umum, atau ceritakan dengan kalimat yang berbeda."
                />
              }
            />
          </>
        )}

        <div ref={sentinelRef} className="h-px" aria-hidden="true" />
      </div>
    </>
  );
}

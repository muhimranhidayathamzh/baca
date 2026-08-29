"use client";

import { Search as SearchIcon, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import PaperList from "@/components/feed/PaperList";
import EmptyState from "@/components/ui/EmptyState";
import { HookShimmer } from "@/components/ui/Shimmer";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { Paper, SearchResponse } from "@/types";

/** Jeda sebelum mengetik dianggap selesai — hemat kuota, hemat rate limit. */
const DEBOUNCE_MS = 450;

type Status = "idle" | "loading" | "done" | "error";

interface Result {
  /** Query yang menghasilkan data ini. */
  q: string;
  papers: Paper[];
  nextPage: number | null;
  error: boolean;
}

const EMPTY_PAPERS: Paper[] = [];
const INITIAL: Result = { q: "", papers: EMPTY_PAPERS, nextPage: null, error: false };

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [result, setResult] = useState<Result>(INITIAL);
  const isOnline = useOnlineStatus();

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
          error: false,
        };
      });
    } catch {
      if (controller.signal.aborted) return;
      if (requestId !== requestIdRef.current) return;
      setResult({ q, papers: EMPTY_PAPERS, nextPage: null, error: true });
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
        <div className="flex items-center gap-2.5 rounded-full border border-desk-line bg-desk-2 px-4 py-2.5 focus-within:border-amber/50">
          <SearchIcon size={17} strokeWidth={1.75} className="shrink-0 text-on-d3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari topik, metode, atau kata kunci…"
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
            hint="Hasilnya diambil dari paper open access terbaru di OpenAlex."
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
          <PaperList
            papers={papers}
            empty={
              <EmptyState
                title={`Nggak ada yang cocok buat “${debounced}”.`}
                hint="Coba kata kunci yang lebih umum, atau pakai istilah bahasa Inggris — sebagian besar paper ditulis dalam bahasa itu."
              />
            }
          />
        )}

        <div ref={sentinelRef} className="h-px" aria-hidden="true" />
      </div>
    </>
  );
}

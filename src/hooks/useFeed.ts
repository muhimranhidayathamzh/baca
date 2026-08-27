"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedMode, FeedResponse, Paper, TopicName } from "@/types";

interface UseFeedParams {
  topic: TopicName | null;
  mode: FeedMode;
  /** paper_id yang sudah dibaca — dibuang dari hasil di sisi server. */
  exclude: string[];
  /** Tunda fetch sampai preferensi dari localStorage selesai dibaca. */
  enabled: boolean;
}

type FeedStatus = "loading" | "loadingMore" | "idle" | "error";

interface FeedState {
  /** Kombinasi topik+mode yang menghasilkan data ini. */
  key: string;
  papers: Paper[];
  cursor: string | null;
  seed?: number;
  hasMore: boolean;
  status: FeedStatus;
}

/** Identitas stabil supaya render dengan data basi tidak bikin array baru. */
const EMPTY_PAPERS: Paper[] = [];

const INITIAL: FeedState = {
  key: "",
  papers: EMPTY_PAPERS,
  cursor: null,
  hasMore: true,
  status: "loading",
};

export function useFeed({ topic, mode, exclude, enabled }: UseFeedParams) {
  const requestKey = `${topic ?? ""}|${mode}`;
  const [state, setState] = useState<FeedState>(INITIAL);
  /**
   * Dipisah dari `state` karena hanya di-set dari event handler (callback
   * IntersectionObserver), bukan dari dalam effect — menjaga `fetchPage` bebas
   * dari setState sinkron sehingga aman dipanggil dari effect.
   */
  const [loadingMore, setLoadingMore] = useState(false);

  /** Tandai request terakhir; hasil request basi dibuang saat tiba. */
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * `exclude` disimpan di ref supaya perubahannya tidak memicu fetch ulang:
   * setiap paper yang dibaca menambah isinya, dan kalau ikut jadi dependency
   * maka feed akan memuat ulang dari awal tiap kali user membuka satu paper.
   */
  const excludeRef = useRef(exclude);
  useEffect(() => {
    excludeRef.current = exclude;
  }, [exclude]);

  const fetchPage = useCallback(
    async (key: string, cursor: string | null, seed: number | undefined, reset: boolean) => {
      // Pergantian topik/mode harus selalu menang: batalkan request yang masih
      // berjalan, jangan buang request yang baru. Kalau yang baru dibuang,
      // effect-nya sudah terlanjur jalan dan tidak akan mencoba lagi — feed
      // akan macet di status loading selamanya.
      if (!reset && loadingRef.current) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      loadingRef.current = true;
      const requestId = ++requestIdRef.current;

      const [topicPart, modePart] = key.split("|");
      const params = new URLSearchParams();
      if (topicPart) params.set("topic", topicPart);
      params.set("mode", modePart ?? "fokus");
      if (!reset && cursor) params.set("cursor", cursor);
      if (!reset && seed !== undefined) params.set("seed", String(seed));
      if (excludeRef.current.length > 0) {
        params.set("exclude", excludeRef.current.join(","));
      }

      try {
        const response = await fetch(`/api/feed?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as FeedResponse;

        // Topik/mode sudah berganti sejak request dikirim — buang hasilnya.
        if (requestId !== requestIdRef.current) return;

        setState((prev) => {
          const base = reset || prev.key !== key ? [] : prev.papers;
          // Jaga-jaga kalau OpenAlex mengembalikan paper yang sama lagi —
          // React error kalau ada key duplikat.
          const seen = new Set(base.map((p) => p.id));
          return {
            key,
            papers: [...base, ...data.papers.filter((p) => !seen.has(p.id))],
            cursor: data.nextCursor,
            seed: data.seed ?? (reset ? undefined : prev.seed),
            hasMore: Boolean(data.nextCursor) && data.papers.length > 0,
            status: "idle",
          };
        });
      } catch {
        // Dibatalkan karena ada request yang lebih baru — bukan kegagalan.
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        setState((prev) => ({ ...prev, status: "error" }));
      } finally {
        // Hanya request terbaru yang boleh melepas kunci; request lama yang
        // baru selesai tidak boleh menandai yang sedang jalan sebagai beres.
        if (requestId === requestIdRef.current) {
          loadingRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  // Muat ulang dari awal setiap kali topik atau mode berganti.
  //
  // `fetchPage` baru memanggil setState SETELAH await, jadi tidak ada cascading
  // render yang sebenarnya. Aturan lint ini menandai fungsi apa pun yang
  // mengandung setState bila dipanggil dari effect — ia tidak bisa melihat
  // batas async. Mengambil data saat parameter berubah memang tugas effect,
  // dan status "loading" pun diturunkan dari `key` yang basi, bukan di-set
  // di sini. Dimatikan sebatas satu baris ini.
  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPage(requestKey, null, undefined, true);
  }, [enabled, requestKey, fetchPage]);

  // Data dari topik/mode sebelumnya tidak boleh bocor ke tampilan sekarang.
  // Status "loading" diturunkan dari sini, bukan di-set saat fetch dimulai.
  const isStale = state.key !== requestKey;
  const papers = isStale ? EMPTY_PAPERS : state.papers;
  const hasMore = isStale ? true : state.hasMore;

  const status: FeedStatus = isStale
    ? state.status === "error"
      ? "error"
      : "loading"
    : loadingMore
      ? "loadingMore"
      : state.status;

  const loadMore = useCallback(() => {
    if (loadingRef.current || isStale || !state.hasMore) return;
    setLoadingMore(true);
    void fetchPage(requestKey, state.cursor, state.seed, false);
  }, [fetchPage, requestKey, isStale, state.hasMore, state.cursor, state.seed]);

  const retry = useCallback(() => {
    void fetchPage(requestKey, null, undefined, true);
  }, [fetchPage, requestKey]);

  return { papers, status, hasMore, loadMore, retry } as const;
}

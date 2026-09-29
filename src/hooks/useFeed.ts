"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildFeedUrl } from "@/lib/feed-url";
import type { FeedMode, FeedResponse, Paper, Summary, TopicName } from "@/types";

/** Kartu per batch (SPEC.md 4.2). */
const BATCH_SIZE = 20;

/**
 * Putaran pengambilan maksimum per batch. Kalau hampir semua paper di sebuah
 * halaman sudah pernah dibaca, halaman berikutnya diambil — tapi tidak tanpa batas.
 */
const MAX_ROUNDS = 3;

/**
 * Aliran yang gagal berturut-turut sebanyak ini dianggap habis, supaya satu
 * topik yang bermasalah tidak membuat infinite scroll mengulang request gagal.
 */
const MAX_STREAM_FAILURES = 2;

/**
 * Aliran yang diambil per putaran. Dua alasan:
 * - Satu halaman Fokus = 2 request ke OpenAlex, dan OpenAlex membatasi
 *   kecepatan per detik: user dengan 6 topik sempat menembakkan 12 request
 *   serentak dan sebagian ditolak 429.
 * - Menunggu semua aliran sebelum menampilkan apa pun membuat kartu pertama
 *   muncul setelah DUA gelombang fetch (Lighthouse: LCP +0,8 s dibanding feed
 *   satu topik). Aliran sisanya ikut masuk di batch berikutnya.
 */
const MAX_PARALLEL_STREAMS = 3;

interface UseFeedParams {
  /** Satu topik (chip topik) atau beberapa (chip "Untukmu"). */
  streams: TopicName[];
  /** Porsi relatif tiap topik di feed campuran (lib/affinity.ts). */
  weights: Record<string, number>;
  mode: FeedMode;
  /** paper_id yang sudah dibaca — disaring di sini, tidak dikirim ke server. */
  exclude: string[];
  /** Tunda fetch sampai preferensi dari localStorage selesai dibaca. */
  enabled: boolean;
}

type FeedStatus = "loading" | "loadingMore" | "idle" | "error";

interface FeedState {
  /** Kombinasi topik+mode yang menghasilkan data ini. */
  key: string;
  papers: Paper[];
  /** Ringkasan yang ikut terkirim bersama feed (sudah ada di cache server). */
  summaries: Record<string, Summary>;
  hasMore: boolean;
  status: FeedStatus;
}

/** Satu aliran paper per topik, dengan cursor dan cadangan paper-nya sendiri. */
interface Stream {
  topic: TopicName;
  cursor: string | null;
  seed: number | null;
  /** Paper yang sudah diambil tapi belum ditampilkan. */
  buffer: Paper[];
  done: boolean;
  failures: number;
  /** Kredit untuk pembagian giliran berbobot (lihat `drawWeighted`). */
  credit: number;
}

interface Session {
  key: string;
  mode: FeedMode;
  streams: Stream[];
  /** Semua paper_id yang sudah masuk cadangan — cegah duplikat antar halaman. */
  seen: Set<string>;
}

/** Identitas stabil supaya render dengan data basi tidak bikin array baru. */
const EMPTY_PAPERS: Paper[] = [];
const EMPTY_SUMMARIES: Record<string, Summary> = {};

const INITIAL: FeedState = {
  key: "",
  papers: EMPTY_PAPERS,
  summaries: EMPTY_SUMMARIES,
  hasMore: true,
  status: "loading",
};

function feedKey(streams: TopicName[], mode: FeedMode): string {
  return `${streams.join(",")}|${mode}`;
}

function createSession(key: string): Session {
  const [topicPart = "", modePart] = key.split("|");
  return {
    key,
    mode: modePart === "explore" ? "explore" : "fokus",
    streams: (topicPart ? (topicPart.split(",") as TopicName[]) : []).map((topic) => ({
      topic,
      cursor: null,
      seed: null,
      buffer: [],
      done: false,
      failures: 0,
      credit: 0,
    })),
    seen: new Set(),
  };
}

/**
 * Ambil paper dari cadangan tiap aliran secara bergiliran sesuai bobotnya
 * (smooth weighted round-robin). Dengan bobot AI=3, Kesehatan=1, hasilnya
 * AI, AI, Kesehatan, AI, … — topik favorit lebih sering muncul, tapi topik
 * lain tetap tersebar merata di sepanjang feed, bukan menumpuk di ujung.
 */
function drawWeighted(
  streams: Stream[],
  count: number,
  weightOf: (topic: TopicName) => number,
): Paper[] {
  const drawn: Paper[] = [];
  while (drawn.length < count) {
    const ready = streams.filter((s) => s.buffer.length > 0);
    if (ready.length === 0) break;

    let total = 0;
    let best = ready[0]!;
    for (const stream of ready) {
      const weight = weightOf(stream.topic);
      total += weight;
      stream.credit += weight;
      if (stream.credit > best.credit) best = stream;
    }
    best.credit -= total;
    drawn.push(best.buffer.shift()!);
  }
  return drawn;
}

export function useFeed({ streams, weights, mode, exclude, enabled }: UseFeedParams) {
  const requestKey = feedKey(streams, mode);
  const [state, setState] = useState<FeedState>(INITIAL);
  /**
   * Dipisah dari `state` karena hanya di-set dari event handler (callback
   * IntersectionObserver), bukan dari dalam effect — menjaga `fetchBatch`
   * bebas dari setState sinkron sehingga aman dipanggil dari effect.
   */
  const [loadingMore, setLoadingMore] = useState(false);

  /** Tandai request terakhir; hasil request basi dibuang saat tiba. */
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<Session | null>(null);

  /**
   * `exclude` dan `weights` disimpan di ref supaya perubahannya tidak memicu
   * fetch ulang: setiap paper yang dibuka menambah riwayat DAN menggeser bobot,
   * dan kalau keduanya jadi dependency, feed akan memuat ulang dari awal tiap
   * kali user membuka satu paper. Nilai terbarunya dipakai di batch berikutnya.
   */
  const excludeRef = useRef(exclude);
  const weightsRef = useRef(weights);
  useEffect(() => {
    excludeRef.current = exclude;
    weightsRef.current = weights;
  }, [exclude, weights]);

  const fetchBatch = useCallback(async (key: string, reset: boolean) => {
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

    if (reset || sessionRef.current?.key !== key) sessionRef.current = createSession(key);
    const session = sessionRef.current;

    const excluded = new Set(excludeRef.current);
    const weightOf = (topic: TopicName) => weightsRef.current[topic] ?? 1;

    const drawn: Paper[] = [];
    const summaries: Record<string, Summary> = {};
    let failed = false;

    try {
      for (let round = 0; round < MAX_ROUNDS && drawn.length < BATCH_SIZE; round++) {
        const live = session.streams.filter((s) => !s.done || s.buffer.length > 0);
        const totalWeight = live.reduce((sum, s) => sum + weightOf(s.topic), 0) || 1;

        // Ambil halaman baru hanya untuk aliran yang cadangannya kurang dari
        // porsinya di batch ini.
        // Yang cadangannya paling sedikit didahulukan — termasuk aliran yang
        // belum pernah diambil sama sekali. Sort stabil, jadi saat reset urutannya
        // sama dengan urutan topik, dan cocok dengan skrip preload.
        const hungry = session.streams
          .filter(
            (s) =>
              !s.done &&
              s.buffer.length < Math.ceil((BATCH_SIZE * weightOf(s.topic)) / totalWeight) + 1,
          )
          .sort((a, b) => a.buffer.length - b.buffer.length)
          .slice(0, MAX_PARALLEL_STREAMS);

        if (hungry.length > 0) {
          const results = await Promise.allSettled(
            hungry.map(async (stream) => {
              // Dirakit lewat fungsi yang sama dengan skrip preload, supaya
              // request pertama memakai ulang respons yang sudah di-preload.
              const url = buildFeedUrl(stream.topic, session.mode, stream.cursor, stream.seed);
              const response = await fetch(url, { signal: controller.signal });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return (await response.json()) as FeedResponse;
            }),
          );

          // Topik/mode sudah berganti sejak request dikirim — buang hasilnya.
          if (requestId !== requestIdRef.current) return;

          results.forEach((result, index) => {
            const stream = hungry[index]!;
            if (result.status === "rejected") {
              stream.failures += 1;
              if (stream.failures >= MAX_STREAM_FAILURES) stream.done = true;
              return;
            }
            const data = result.value;
            Object.assign(summaries, data.summaries);
            stream.failures = 0;
            stream.cursor = data.nextCursor;
            stream.seed = data.seed ?? stream.seed;
            stream.done = !data.nextCursor || data.papers.length === 0;
            for (const paper of data.papers) {
              if (excluded.has(paper.id) || session.seen.has(paper.id)) continue;
              session.seen.add(paper.id);
              stream.buffer.push(paper);
            }
          });

          failed = results.every((r) => r.status === "rejected");
        }

        drawn.push(...drawWeighted(session.streams, BATCH_SIZE - drawn.length, weightOf));
        if (failed || session.streams.every((s) => s.done)) break;
      }
    } finally {
      // Hanya request terbaru yang boleh melepas kunci; request lama yang
      // baru selesai tidak boleh menandai yang sedang jalan sebagai beres.
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
        setLoadingMore(false);
      }
    }

    if (requestId !== requestIdRef.current) return;

    if (failed && drawn.length === 0) {
      setState((prev) => ({ ...prev, status: "error" }));
      return;
    }

    const hasMore = session.streams.some((s) => !s.done || s.buffer.length > 0);
    setState((prev) => {
      const fresh = reset || prev.key !== key;
      return {
        key,
        papers: fresh ? drawn : [...prev.papers, ...drawn],
        summaries: fresh ? summaries : { ...prev.summaries, ...summaries },
        hasMore,
        status: "idle",
      };
    });
  }, []);

  // Muat ulang dari awal setiap kali topik atau mode berganti. `fetchBatch`
  // baru memanggil setState setelah await, dan status "loading" diturunkan dari
  // `key` yang basi — bukan di-set di sini.
  useEffect(() => {
    if (!enabled) return;
    // Aturan ini tidak bisa melihat batas async: saat reset, setiap aliran
    // masih kosong sehingga selalu di-fetch, dan setState baru terjadi
    // setelah await fetch itu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchBatch(requestKey, true);
  }, [enabled, requestKey, fetchBatch]);

  // Data dari topik/mode sebelumnya tidak boleh bocor ke tampilan sekarang.
  const isStale = state.key !== requestKey;
  const papers = isStale ? EMPTY_PAPERS : state.papers;
  const summaries = isStale ? EMPTY_SUMMARIES : state.summaries;
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
    void fetchBatch(requestKey, false);
  }, [fetchBatch, requestKey, isStale, state.hasMore]);

  const retry = useCallback(() => {
    void fetchBatch(requestKey, true);
  }, [fetchBatch, requestKey]);

  return { papers, summaries, status, hasMore, loadMore, retry } as const;
}

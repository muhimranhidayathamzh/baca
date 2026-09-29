"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SUMMARY_VERSION } from "@/lib/summary-version";
import type { Summary } from "@/types";

/**
 * Summarization berbasis viewport (SPEC.md Bagian 4.2).
 *
 * Hanya kartu yang MENDEKATI viewport yang diringkas, dan maksimum 3 request
 * berjalan paralel. Dua batasan ini yang membuat feed terasa cepat sekaligus
 * hemat kuota AI — kartu yang tidak pernah dilihat user tidak pernah dibayar.
 *
 * Saat server bilang AI sedang penuh (503 + retryAfter), kartu TIDAK dianggap
 * gagal: shimmer-nya tetap, seluruh antrean berhenti sejenak, lalu kartu itu
 * dicoba lagi. Berhenti bersama penting — kalau tiap kartu mencoba sendiri-
 * sendiri, mereka hanya saling menghabiskan jatah yang sama.
 */

/** Mulai meringkas sebelum kartu benar-benar terlihat, biar tidak kelihatan loading. */
const ROOT_MARGIN = "400px";

/** Maksimum request /api/summarize yang berjalan bersamaan. */
const MAX_CONCURRENT = 3;

/**
 * Berapa kali satu kartu boleh disuruh menunggu sebelum menyerah. Dengan jeda
 * server maksimum 15 detik, kartu menunggu paling lama sekitar satu menit.
 */
const MAX_BUSY_RETRIES = 4;

/** Jeda terpanjang yang dipatuhi per percobaan, apa pun kata server. */
const MAX_WAIT_SECONDS = 20;

export type SummaryState =
  | { status: "loading" }
  | { status: "done"; summary: Summary }
  | { status: "error" };

type FetchOutcome =
  | { kind: "done"; summary: Summary }
  | { kind: "busy"; retryAfter: number }
  | { kind: "error" };

async function requestSummary(paperId: string): Promise<FetchOutcome> {
  try {
    // Hanya paper_id yang dikirim — server mengambil abstraknya sendiri
    // (SPEC.md Bagian 2). GET supaya ringkasan bisa dilayani cache CDN; `v`
    // membuat CDN tidak menyajikan ringkasan dari prompt versi lama.
    const response = await fetch(
      `/api/summarize?paper_id=${encodeURIComponent(paperId)}&v=${SUMMARY_VERSION}`,
    );

    if (response.ok) return { kind: "done", summary: (await response.json()) as Summary };

    if (response.status === 503) {
      const body = (await response.json().catch(() => null)) as { retryAfter?: unknown } | null;
      const retryAfter = typeof body?.retryAfter === "number" ? body.retryAfter : null;
      if (retryAfter !== null) return { kind: "busy", retryAfter };
    }

    // Rate limit per-IP kita sendiri: sementara, sama seperti "penuh". Dulu
    // kartu langsung dianggap gagal permanen — terlihat saat Lighthouse dijalankan
    // berulang dan semua kartu jatuh ke judul asli.
    if (response.status === 429) {
      const header = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
      const retryAfter = Number.isFinite(header) && header > 0 ? header : 10;
      return { kind: "busy", retryAfter: Math.min(retryAfter, MAX_WAIT_SECONDS) };
    }
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

export function useViewportSummarize(known: Record<string, Summary>) {
  const [summaries, setSummaries] = useState<Record<string, SummaryState>>({});

  /** Ringkasan yang sudah terkirim bersama daftar — tidak perlu diminta lagi. */
  const knownRef = useRef(known);
  useEffect(() => {
    knownRef.current = known;
  }, [known]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  /** Elemen per paperId, supaya bisa di-unobserve saat kartu dilepas. */
  const elementsRef = useRef(new Map<string, Element>());
  const idByElementRef = useRef(new WeakMap<Element, string>());
  /** Ref callback di-cache supaya identitasnya stabil antar render. */
  const refCallbacksRef = useRef(new Map<string, (el: HTMLElement | null) => void>());

  const queueRef = useRef<string[]>([]);
  const activeRef = useRef(0);
  /** paperId yang sudah pernah diminta — cegah request dobel. */
  const requestedRef = useRef(new Set<string>());
  /** Berapa kali tiap kartu sudah disuruh menunggu. */
  const busyCountRef = useRef(new Map<string, number>());
  /** Antrean tidak memulai request baru sebelum waktu ini (ms epoch). */
  const pausedUntilRef = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const setState = useCallback((paperId: string, state: SummaryState) => {
    if (mountedRef.current) setSummaries((prev) => ({ ...prev, [paperId]: state }));
  }, []);

  /**
   * Jalankan antrean sampai batas konkurensi tercapai. `run` memanggil dirinya
   * sendiri lewat nama fungsi dalam — sebuah useCallback tidak boleh
   * mereferensikan dirinya saat dideklarasikan.
   */
  const pump = useCallback(() => {
    function run() {
      const waitMs = pausedUntilRef.current - Date.now();
      if (waitMs > 0) {
        if (!resumeTimerRef.current) {
          resumeTimerRef.current = setTimeout(() => {
            resumeTimerRef.current = null;
            run();
          }, waitMs);
        }
        return;
      }

      while (activeRef.current < MAX_CONCURRENT && queueRef.current.length > 0) {
        const paperId = queueRef.current.shift()!;
        activeRef.current += 1;

        void requestSummary(paperId).then((outcome) => {
          activeRef.current -= 1;

          if (outcome.kind === "done") {
            busyCountRef.current.delete(paperId);
            setState(paperId, { status: "done", summary: outcome.summary });
          } else if (outcome.kind === "busy") {
            const attempts = (busyCountRef.current.get(paperId) ?? 0) + 1;
            busyCountRef.current.set(paperId, attempts);
            if (attempts > MAX_BUSY_RETRIES) {
              requestedRef.current.delete(paperId);
              setState(paperId, { status: "error" });
            } else {
              // Kembali ke DEPAN antrean: kartu ini sudah lebih lama menunggu
              // daripada kartu yang baru masuk viewport.
              queueRef.current.unshift(paperId);
              pausedUntilRef.current = Math.max(
                pausedUntilRef.current,
                Date.now() + outcome.retryAfter * 1000,
              );
            }
          } else {
            // Boleh dicoba lagi lewat `retry` (tombol di reader).
            requestedRef.current.delete(paperId);
            setState(paperId, { status: "error" });
          }

          if (mountedRef.current) run();
        });
      }
    }
    run();
  }, [setState]);

  const enqueue = useCallback(
    (paperId: string) => {
      if (requestedRef.current.has(paperId) || knownRef.current[paperId]) return;
      requestedRef.current.add(paperId);
      queueRef.current.push(paperId);
      setSummaries((prev) =>
        prev[paperId]?.status === "loading" ? prev : { ...prev, [paperId]: { status: "loading" } },
      );
      pump();
    },
    [pump],
  );

  /** Coba ringkas ulang kartu yang gagal (dipanggil dari tombol "Coba lagi"). */
  const retry = useCallback(
    (paperId: string) => {
      busyCountRef.current.delete(paperId);
      enqueue(paperId);
    },
    [enqueue],
  );

  useEffect(() => {
    mountedRef.current = true;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const paperId = idByElementRef.current.get(entry.target);
          if (!paperId) continue;

          // Sekali masuk antrean, kartu tidak perlu diamati lagi.
          observer.unobserve(entry.target);
          enqueue(paperId);
        }
      },
      { rootMargin: ROOT_MARGIN },
    );

    observerRef.current = observer;

    // Kartu yang sudah ter-render sebelum observer siap ikut didaftarkan.
    for (const element of elementsRef.current.values()) {
      observer.observe(element);
    }

    return () => {
      mountedRef.current = false;
      observer.disconnect();
      observerRef.current = null;
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    };
  }, [enqueue]);

  /** Ref callback untuk dipasang di elemen kartu. */
  const getCardRef = useCallback((paperId: string) => {
    const cached = refCallbacksRef.current.get(paperId);
    if (cached) return cached;

    const callback = (element: HTMLElement | null) => {
      const previous = elementsRef.current.get(paperId);
      if (previous) {
        observerRef.current?.unobserve(previous);
        elementsRef.current.delete(paperId);
      }

      if (element) {
        elementsRef.current.set(paperId, element);
        idByElementRef.current.set(element, paperId);
        observerRef.current?.observe(element);
      }
    };

    refCallbacksRef.current.set(paperId, callback);
    return callback;
  }, []);

  return { summaries, getCardRef, retry } as const;
}

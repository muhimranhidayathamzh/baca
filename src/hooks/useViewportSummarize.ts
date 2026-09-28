"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Summary } from "@/types";

/**
 * Summarization berbasis viewport (SPEC.md Bagian 4.2).
 *
 * Hanya kartu yang MENDEKATI viewport yang diringkas, dan maksimum 3 request
 * berjalan paralel. Dua batasan ini yang membuat feed terasa cepat sekaligus
 * hemat kuota AI — kartu yang tidak pernah dilihat user tidak pernah dibayar.
 */

/** Mulai meringkas sebelum kartu benar-benar terlihat, biar tidak kelihatan loading. */
const ROOT_MARGIN = "400px";

/** Maksimum request /api/summarize yang berjalan bersamaan. */
const MAX_CONCURRENT = 3;

export type SummaryState =
  | { status: "loading" }
  | { status: "done"; summary: Summary }
  | { status: "error" };

export function useViewportSummarize() {
  const [summaries, setSummaries] = useState<Record<string, SummaryState>>({});

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
  const mountedRef = useRef(true);

  const runSummarize = useCallback(async (paperId: string) => {
    try {
      // Hanya paper_id yang dikirim — server mengambil abstraknya sendiri
      // (SPEC.md Bagian 2). GET supaya ringkasan bisa dilayani cache CDN.
      const response = await fetch(`/api/summarize?paper_id=${encodeURIComponent(paperId)}`);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const summary = (await response.json()) as Summary;

      if (mountedRef.current) {
        setSummaries((prev) => ({ ...prev, [paperId]: { status: "done", summary } }));
      }
    } catch {
      if (mountedRef.current) {
        setSummaries((prev) => ({ ...prev, [paperId]: { status: "error" } }));
      }
      // Gagal sekali boleh dicoba lagi kalau kartunya masuk viewport lagi.
      requestedRef.current.delete(paperId);
    }
  }, []);

  /**
   * Jalankan antrean sampai batas konkurensi tercapai. Rekursi dilakukan lewat
   * fungsi bernama di dalam, bukan memanggil `pump` dari dalam dirinya sendiri
   * — sebuah useCallback tidak boleh mereferensikan dirinya saat dideklarasikan.
   */
  const pump = useCallback(() => {
    function run() {
      while (activeRef.current < MAX_CONCURRENT && queueRef.current.length > 0) {
        const paperId = queueRef.current.shift();
        if (!paperId) break;

        activeRef.current += 1;
        setSummaries((prev) =>
          prev[paperId] ? prev : { ...prev, [paperId]: { status: "loading" } },
        );

        void runSummarize(paperId).finally(() => {
          activeRef.current -= 1;
          run();
        });
      }
    }
    run();
  }, [runSummarize]);

  const enqueue = useCallback(
    (paperId: string) => {
      if (requestedRef.current.has(paperId)) return;
      requestedRef.current.add(paperId);
      queueRef.current.push(paperId);
      pump();
    },
    [pump],
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

  return { summaries, getCardRef } as const;
}

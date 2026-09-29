"use client";

import { useCallback } from "react";
import { STORAGE_KEYS, useLocalStorage } from "./useLocalStorage";
import type { Affinity } from "@/lib/affinity";
import type { Paper, TopicName } from "@/types";

/**
 * Bookmark & riwayat baca — dua koleksi yang dipakai bareng oleh feed, reader,
 * dan (nanti di Fase 4) halaman Saved & Profile.
 *
 * Paper yang di-bookmark disimpan utuh, bukan hanya id-nya, supaya halaman
 * Saved bisa menampilkan kartu tanpa perlu memanggil API lagi (SPEC.md 4.5).
 */

/**
 * Batas riwayat yang disimpan. Riwayat disaring di browser (hooks/useFeed.ts),
 * jadi panjangnya tidak lagi dibatasi panjang URL.
 */
const MAX_HISTORY = 500;

/** Array kosong yang identitasnya stabil, supaya snapshot tidak berubah-ubah. */
const EMPTY_PAPERS: Paper[] = [];
const EMPTY_IDS: string[] = [];
const EMPTY_AFFINITY: Affinity = {};

export function useSavedPapers() {
  const { value: saved, setValue } = useLocalStorage<Paper[]>(
    STORAGE_KEYS.saved,
    EMPTY_PAPERS,
  );

  const isSaved = useCallback((id: string) => saved.some((p) => p.id === id), [saved]);

  const toggleSaved = useCallback(
    (paper: Paper) => {
      setValue((prev) =>
        prev.some((p) => p.id === paper.id)
          ? prev.filter((p) => p.id !== paper.id)
          : [paper, ...prev],
      );
    },
    [setValue],
  );

  return { saved, isSaved, toggleSaved } as const;
}

export function useReadHistory() {
  const { value: history, setValue } = useLocalStorage<string[]>(
    STORAGE_KEYS.readHistory,
    EMPTY_IDS,
  );

  /**
   * Tandai paper sudah dibaca. Id yang sudah ada dipindah ke depan supaya
   * `exclude` selalu berisi yang paling relevan saat dipotong.
   */
  const markAsRead = useCallback(
    (paperId: string) => {
      setValue((prev) => [paperId, ...prev.filter((id) => id !== paperId)].slice(0, MAX_HISTORY));
    },
    [setValue],
  );

  return { history, markAsRead } as const;
}

/** Hitungan "dibuka" per topik untuk feed "Untukmu" (lib/affinity.ts). */
export function useTopicAffinity() {
  const { value: affinity, setValue } = useLocalStorage<Affinity>(
    STORAGE_KEYS.affinity,
    EMPTY_AFFINITY,
  );

  const recordOpen = useCallback(
    (topic: TopicName | null) => {
      if (!topic) return;
      setValue((prev) => ({ ...prev, [topic]: (prev[topic] ?? 0) + 1 }));
    },
    [setValue],
  );

  return { affinity, recordOpen } as const;
}

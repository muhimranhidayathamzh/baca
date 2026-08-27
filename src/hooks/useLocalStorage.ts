"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * Kunci localStorage (SPEC.md Bagian 2). Dikumpulkan di satu tempat supaya
 * tidak ada typo string yang tersebar di banyak file.
 */
export const STORAGE_KEYS = {
  onboarded: "baca_onboarded",
  topics: "baca_topics",
  mode: "baca_mode",
  saved: "baca_saved",
  readHistory: "baca_read_history",
  /**
   * Chip topik yang sedang aktif di feed. Tidak ada di daftar awal SPEC —
   * ditambahkan supaya pilihan chip user bertahan saat pindah halaman dan
   * kembali lagi, bukan selalu reset ke topik pertama.
   */
  activeTopic: "baca_active_topic",
} as const;

/**
 * Event internal untuk sinkronisasi antar komponen di tab yang sama.
 * Event `storage` bawaan browser hanya menyala di tab LAIN, jadi tanpa ini
 * dua komponen yang membaca kunci sama tidak akan saling tahu saat salah
 * satunya menulis.
 */
const SYNC_EVENT = "baca:storage";

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(SYNC_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SYNC_EVENT, callback);
  };
}

/**
 * localStorage dengan tipe, aman untuk SSR.
 *
 * Memakai `useSyncExternalStore` — API React untuk membaca sumber data di luar
 * React. Ini menangani perbedaan render server vs client dengan benar, dan
 * membuat semua komponen yang memakai kunci sama selalu sinkron.
 */
export function useLocalStorage<T>(key: string, fallback: T) {
  /**
   * Snapshot harus stabil: `useSyncExternalStore` membandingkan hasil
   * `getSnapshot` dengan `Object.is`. Kalau JSON di-parse ulang tiap panggilan,
   * hasilnya objek baru terus dan React akan render tanpa henti. Cache ini
   * memastikan objek yang sama dikembalikan selama string mentahnya tidak berubah.
   */
  const cacheRef = useRef<{ raw: string | null; parsed: T } | null>(null);

  const getSnapshot = useCallback((): T => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      // Mode privat / storage diblokir.
      return fallback;
    }

    const cached = cacheRef.current;
    if (cached && cached.raw === raw) return cached.parsed;

    let parsed = fallback;
    if (raw !== null) {
      try {
        parsed = JSON.parse(raw) as T;
      } catch {
        // Data korup — perlakukan seperti belum ada.
        parsed = fallback;
      }
    }

    cacheRef.current = { raw, parsed };
    return parsed;
    // `fallback` sering berupa literal baru tiap render (mis. []), jadi tidak
    // dijadikan dependency — nilainya hanya dipakai saat kunci belum terisi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const getServerSnapshot = useCallback((): T => fallback, [fallback]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = getSnapshot();
      const resolved = typeof next === "function" ? (next as (p: T) => T)(current) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
        window.dispatchEvent(new Event(SYNC_EVENT));
      } catch {
        // Kuota penuh atau storage diblokir — tidak ada yang bisa disimpan.
      }
    },
    [key, getSnapshot],
  );

  return { value, setValue } as const;
}

/**
 * `false` saat render di server dan pada render hidrasi pertama, `true`
 * sesudahnya. Dipakai untuk menunda fetch sampai preferensi asli dari
 * localStorage benar-benar terbaca.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

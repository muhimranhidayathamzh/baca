"use client";

import { track } from "@vercel/analytics";
import type { TopicName } from "@/types";

/**
 * Dua metrik utama yang diminta SPEC.md Bagian 9 langkah 29:
 *   1. Berapa persen user yang benar-benar membuka paper aslinya
 *   2. Berapa paper yang dibaca per user per minggu
 *
 * Keduanya butuh event kustom — pageview biasa tidak bisa menjawabnya, karena
 * membuka reader dan mengklik "Buka paper asli" sama-sama terjadi tanpa
 * perpindahan halaman.
 *
 * Sengaja TIDAK mengirim apa pun yang bisa mengidentifikasi orang: hanya id
 * paper dan nama topik. Vercel Analytics juga tidak memakai cookie.
 *
 * Di luar produksi Vercel, `track()` tidak melakukan apa-apa — jadi ini aman
 * dipanggil saat dev tanpa perlu penjagaan tambahan.
 */

/** Reader dibuka — dasar hitungan "paper dibaca per user per minggu". */
export function trackPaperOpened(paperId: string, topic: TopicName | null): void {
  track("paper_opened", { paper: paperId, topic: topic ?? "unknown" });
}

/** Tautan ke paper asli diklik — pembilang untuk metrik konversi ke sumber. */
export function trackOriginalPaperOpened(paperId: string, topic: TopicName | null): void {
  track("original_paper_opened", { paper: paperId, topic: topic ?? "unknown" });
}

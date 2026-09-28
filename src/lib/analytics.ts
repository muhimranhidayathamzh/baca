"use client";

import { STORAGE_KEYS } from "@/hooks/useLocalStorage";

/**
 * Dua metrik utama SPEC.md Bagian 9 langkah 29, dicatat lewat /api/event.
 *
 * Custom event Vercel Analytics TIDAK tersedia di plan Hobby (terverifikasi
 * di dokumentasi Vercel, September 2026), jadi metrik ini dihitung sendiri di
 * Upstash. Vercel Analytics tetap dipakai untuk pageview.
 *
 * Yang dikirim hanya nama event dan ID perangkat acak — bukan id paper, bukan
 * topik, bukan apa pun yang bisa mengaitkan bacaan dengan seseorang.
 */

type MetricEvent = "paper_opened" | "original_paper_opened";

/**
 * ID acak per browser, dibuat sekali lalu disimpan di localStorage. Terhapus
 * oleh tombol Reset di Profile (ikut STORAGE_KEYS), yang otomatis membuat
 * perangkat itu terhitung sebagai pembaca baru.
 */
function deviceId(): string | null {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEYS.device);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEYS.device, fresh);
    return fresh;
  } catch {
    // Mode privat / storage diblokir — lewati saja, metrik bukan hal kritis.
    return null;
  }
}

function send(event: MetricEvent): void {
  if (typeof window === "undefined") return;
  const device = deviceId();
  if (!device) return;

  const body = JSON.stringify({ event, device });
  // sendBeacon tetap terkirim walau halaman sedang ditinggal — penting untuk
  // "Buka paper asli" yang membuka tab baru.
  if (navigator.sendBeacon?.("/api/event", new Blob([body], { type: "application/json" }))) {
    return;
  }
  void fetch("/api/event", { method: "POST", body, keepalive: true }).catch(() => {});
}

/** Reader dibuka — dasar hitungan "paper dibaca per user per minggu". */
export function trackPaperOpened(): void {
  send("paper_opened");
}

/** Tautan ke paper asli diklik — pembilang metrik "% user yang buka paper asli". */
export function trackOriginalPaperOpened(): void {
  send("original_paper_opened");
}

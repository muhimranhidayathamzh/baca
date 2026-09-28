import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Satu klien Upstash Redis untuk seluruh server: rate limiting, cache
 * ringkasan, batas harian AI, dan penghitung event anonim.
 *
 * Mengembalikan null kalau kredensial belum diisi. Pemanggil yang menentukan
 * perilakunya — rate limiting gagal-tertutup di produksi, sementara cache dan
 * penghitung cukup dilewati.
 */
let cached: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (cached !== undefined) return cached;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  cached = url && token ? new Redis({ url, token }) : null;
  return cached;
}

/** Prefix semua kunci supaya database bisa dipakai bersama tanpa tabrakan. */
export const KEY_PREFIX = "baca";

/** Tanggal UTC "2026-09-28" — dasar kunci harian. */
export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Minggu ISO "2026-W39". Dipakai untuk metrik "per user per minggu" —
 * minggu ISO selalu dimulai Senin dan tidak terpotong pergantian tahun.
 */
export function isoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

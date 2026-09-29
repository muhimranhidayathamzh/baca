import "server-only";
import { KEY_PREFIX, getRedis } from "./redis";
import { SUMMARY_VERSION } from "./summary-version";
import type { Summary } from "@/types";

/**
 * Cache ringkasan lintas user di Upstash Redis (menggantikan tabel Supabase
 * `summaries` — lihat SPEC.md Bagian 2).
 *
 * Ini lapis KEDUA. Lapis pertama adalah CDN Vercel: /api/summarize adalah GET
 * dengan Cache-Control, jadi ringkasan yang sama untuk wilayah yang sama
 * disajikan edge tanpa memanggil fungsi sama sekali. Redis menangkap sisanya:
 * wilayah lain, cache CDN yang tergusur, atau deploy baru.
 *
 * Kegagalan cache TIDAK PERNAH menggagalkan request — paling buruk berarti
 * memanggil AI lagi.
 */

/**
 * Ringkasan disimpan 180 hari. Batasnya menjaga penyimpanan tetap di bawah
 * 256 MB free tier Upstash (~1,5 KB per ringkasan ≈ 170 ribu paper), dan paper
 * yang tak dibuka setengah tahun wajar diringkas ulang dengan model yang lebih baru.
 */
const TTL_SECONDS = 60 * 60 * 24 * 180;

/**
 * Versi prompt ikut jadi bagian kunci: setelah prompt diperbaiki, ringkasan
 * lama tidak dipakai lagi dan paper diringkas ulang saat pertama dibuka.
 * Kunci versi lama kedaluwarsa sendiri lewat TTL.
 */
function key(paperId: string): string {
  return `${KEY_PREFIX}:summary:v${SUMMARY_VERSION}:${paperId}`;
}

function isSummary(value: unknown): value is Summary {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.hook === "string" &&
    typeof v.deep === "string" &&
    Array.isArray(v.quick) &&
    (v.key === null || typeof v.key === "string")
  );
}

export async function getCachedSummary(paperId: string): Promise<Summary | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    // @upstash/redis otomatis mem-parse JSON yang disimpan lewat set().
    const value = await redis.get<unknown>(key(paperId));
    return isSummary(value) ? value : null;
  } catch (error) {
    console.error("[summary-cache] Gagal membaca:", error);
    return null;
  }
}

export async function cacheSummary(paperId: string, summary: Summary): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(key(paperId), summary, { ex: TTL_SECONDS });
  } catch (error) {
    console.error("[summary-cache] Gagal menyimpan:", error);
  }
}

/**
 * Ambil ringkasan yang sudah ada untuk banyak paper sekaligus (satu MGET).
 *
 * Dipakai /api/feed dan /api/search supaya kartu yang ringkasannya sudah
 * pernah dibuat — oleh siapa pun — langsung tampil lengkap dengan hook-nya,
 * tanpa request /api/summarize terpisah. Paper yang belum punya ringkasan
 * tidak ada di hasil; client meringkasnya seperti biasa.
 */
export async function getCachedSummaries(paperIds: string[]): Promise<Record<string, Summary>> {
  const redis = getRedis();
  if (!redis || paperIds.length === 0) return {};

  try {
    const values = await redis.mget<unknown[]>(...paperIds.map(key));
    const found: Record<string, Summary> = {};
    values.forEach((value, index) => {
      if (isSummary(value)) found[paperIds[index]!] = value;
    });
    return found;
  } catch (error) {
    console.error("[summary-cache] Gagal membaca banyak:", error);
    return {};
  }
}

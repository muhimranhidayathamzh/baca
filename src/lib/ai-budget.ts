import "server-only";
import { KEY_PREFIX, dayKey, getRedis } from "./redis";

/**
 * Batas harian GLOBAL untuk panggilan AI.
 *
 * Rate limit per-IP (30/menit) tidak membatasi total: beberapa IP sudah cukup
 * untuk menghabiskan kuota Gemini harian bagi semua user, atau — di tier
 * berbayar — memunculkan tagihan kejutan. Batas ini menutup celah itu.
 * Yang dihitung hanya cache miss, karena hanya itu yang benar-benar memanggil AI.
 *
 * Saat batas tercapai, ringkasan jatuh ke fallback yang sama seperti saat AI
 * gagal — app tetap berfungsi, hanya tanpa hook AI sampai hari berganti (UTC).
 */
const DEFAULT_DAILY_LIMIT = 1000;

function dailyLimit(): number {
  const raw = Number.parseInt(process.env.AI_DAILY_LIMIT ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_LIMIT;
}

/**
 * Pesan satu jatah panggilan AI untuk hari ini. `false` berarti jatah habis.
 *
 * INCR itu atomik, jadi dua instance serverless yang bersamaan tidak bisa
 * sama-sama lolos di hitungan terakhir.
 *
 * Tanpa Redis (dev lokal) selalu `true`: di produksi kondisi itu tidak pernah
 * sampai ke sini karena rate limiting sudah menolak request lebih dulu.
 */
export async function reserveAiCall(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;

  const key = `${KEY_PREFIX}:ai-budget:${dayKey()}`;
  try {
    const used = await redis.incr(key);
    // Kunci dibiarkan hidup 2 hari supaya tidak menumpuk selamanya.
    if (used === 1) await redis.expire(key, 60 * 60 * 48);
    return used <= dailyLimit();
  } catch (error) {
    // Redis bermasalah: lebih baik tetap melayani user daripada mematikan
    // ringkasan — rate limit per-IP masih menjaga dari penyalahgunaan kasar.
    console.error("[ai-budget] Gagal membaca jatah:", error);
    return true;
  }
}

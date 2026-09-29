import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { KEY_PREFIX, dayKey, getRedis } from "./redis";

/**
 * Penjatah GLOBAL untuk panggilan AI — dua lapis, untuk semua user sekaligus.
 *
 * 1. Per menit. Free tier Gemini hanya mengizinkan 15 request/menit per model
 *    (terverifikasi dari error 429: `GenerateRequestsPerMinutePerProjectPerModel-FreeTier`).
 *    Tanpa penjatah ini, satu user yang scroll cepat sudah cukup untuk
 *    menembusnya, dan setiap kartu yang kena jatuh ke kondisi gagal.
 *    Dengan penjatah, request yang kelebihan tidak pernah sampai ke Gemini:
 *    server membalas "coba lagi dalam N detik" dan kartunya menunggu.
 *
 * 2. Per hari. Rate limit per-IP tidak membatasi total: beberapa IP sudah
 *    cukup menghabiskan kuota harian bagi semua user, atau — di tier
 *    berbayar — memunculkan tagihan kejutan.
 *
 * Yang dihitung hanya cache miss, karena hanya itu yang benar-benar memanggil AI.
 */
const DEFAULT_DAILY_LIMIT = 1000;

/**
 * Di bawah batas 15 Gemini: sliding window Upstash adalah perkiraan, dan
 * sisa ruang ini menjaga request yang lolos tidak ditolak Google di ujung
 * jendela. Naikkan lewat AI_RPM_LIMIT kalau billing Gemini sudah aktif.
 */
const DEFAULT_RPM_LIMIT = 12;

/** Batas atas jeda yang disuruh ke client, supaya kartu tidak menunggu terlalu lama. */
const MAX_RETRY_AFTER = 15;

function envLimit(name: string, fallback: number): number {
  const raw = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

let rpmLimiter: Ratelimit | null = null;

function getRpmLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  rpmLimiter ??= new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(envLimit("AI_RPM_LIMIT", DEFAULT_RPM_LIMIT), "1 m"),
    analytics: false,
    prefix: `${KEY_PREFIX}:ai-rpm`,
  });
  return rpmLimiter;
}

export type AiSlot =
  | { ok: true }
  /** Jatah menit ini penuh — sembuh sendiri setelah `retryAfter` detik. */
  | { ok: false; reason: "busy"; retryAfter: number }
  /** Jatah hari ini habis — tidak ada gunanya mencoba lagi sampai hari berganti (UTC). */
  | { ok: false; reason: "daily" };

/**
 * Pesan satu jatah panggilan AI.
 *
 * Tanpa Redis (dev lokal) selalu lolos: di produksi kondisi itu tidak pernah
 * sampai ke sini karena rate limiting sudah menolak request lebih dulu, dan
 * kalau Gemini tetap menolak, lib/ai.ts mengenali 429-nya.
 */
export async function reserveAiCall(): Promise<AiSlot> {
  const redis = getRedis();
  const limiter = getRpmLimiter();
  if (!redis || !limiter) return { ok: true };

  // Jatah per menit dicek DULU: request yang ditolak di sini tidak boleh
  // ikut memakan jatah harian.
  try {
    const minute = await limiter.limit("global");
    if (!minute.success) {
      const seconds = Math.ceil((minute.reset - Date.now()) / 1000);
      return {
        ok: false,
        reason: "busy",
        retryAfter: Math.min(Math.max(seconds, 2), MAX_RETRY_AFTER),
      };
    }
  } catch (error) {
    // Redis bermasalah: tetap layani user. Kalau Gemini menolak, 429-nya
    // dikenali di lib/ai.ts dan client tetap disuruh menunggu.
    console.error("[ai-budget] Gagal membaca jatah per menit:", error);
  }

  const key = `${KEY_PREFIX}:ai-budget:${dayKey()}`;
  try {
    const used = await redis.incr(key);
    // Kunci dibiarkan hidup 2 hari supaya tidak menumpuk selamanya.
    if (used === 1) await redis.expire(key, 60 * 60 * 48);
    return used <= envLimit("AI_DAILY_LIMIT", DEFAULT_DAILY_LIMIT)
      ? { ok: true }
      : { ok: false, reason: "daily" };
  } catch (error) {
    console.error("[ai-budget] Gagal membaca jatah harian:", error);
    return { ok: true };
  }
}

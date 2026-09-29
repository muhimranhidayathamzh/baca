import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "./redis";

/**
 * Rate limiting untuk semua API route (CLAUDE.md aturan #4 — non-negotiable).
 *
 * Produksi memakai Upstash Redis supaya hitungannya konsisten lintas instance
 * serverless Vercel. Saat dev tanpa kredensial Upstash, dipakai limiter
 * in-memory supaya `npm run dev` tetap jalan; di produksi env yang kosong
 * membuat request DITOLAK (fail closed), bukan diloloskan tanpa proteksi.
 */

const isProduction = process.env.NODE_ENV === "production";

/** Batas per endpoint, sesuai SPEC.md Bagian 2. */
export const LIMITS = {
  feed: { requests: 60, window: "1 m" },
  summarize: { requests: 30, window: "1 m" },
  search: { requests: 60, window: "1 m" },
  /** Penghitung metrik anonim — longgar, tapi tetap dibatasi agar tak bisa dibanjiri. */
  event: { requests: 120, window: "1 m" },
  /** Endpoint statistik pemilik — ketat, karena ada token yang bisa ditebak-tebak. */
  stats: { requests: 10, window: "1 m" },
} as const;

export type LimitName = keyof typeof LIMITS;

const upstashLimiters = new Map<LimitName, Ratelimit>();

function getUpstashLimiter(name: LimitName): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const cached = upstashLimiters.get(name);
  if (cached) return cached;

  const { requests, window } = LIMITS[name];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: false,
    prefix: `baca:${name}`,
  });
  upstashLimiters.set(name, limiter);
  return limiter;
}

/**
 * Fallback in-memory untuk dev. Sengaja sederhana: sliding window kasar per
 * proses. Tidak cocok untuk produksi (tiap instance punya hitungan sendiri),
 * makanya produksi tanpa Upstash langsung ditolak di `checkRateLimit`.
 */
const memoryHits = new Map<string, number[]>();

function checkInMemory(name: LimitName, identifier: string): boolean {
  const { requests } = LIMITS[name];
  const windowMs = 60_000;
  const now = Date.now();
  const key = `${name}:${identifier}`;

  const hits = (memoryHits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= requests) {
    memoryHits.set(key, hits);
    return false;
  }

  hits.push(now);
  memoryHits.set(key, hits);

  // Cegah Map tumbuh tanpa batas selama sesi dev panjang.
  if (memoryHits.size > 5_000) {
    for (const [k, v] of memoryHits) {
      if (v.every((t) => now - t >= windowMs)) memoryHits.delete(k);
    }
  }

  return true;
}

/**
 * Ambil IP klien. Vercel selalu mengisi x-forwarded-for; header lain jadi
 * cadangan. Kalau benar-benar tidak diketahui, semua request tak dikenal
 * berbagi satu bucket "unknown" — sengaja ketat, bukan longgar.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface RateLimitResult {
  success: boolean;
  /** Alasan gagal, untuk logging — tidak pernah dibocorkan ke client. */
  reason?: "limit_exceeded" | "not_configured";
  /** Detik sampai jatah IP ini terbuka lagi (hanya dari Upstash). */
  retryAfter?: number;
}

/**
 * Periksa kuota satu request. Panggil di awal SETIAP route handler sebelum
 * kerja apa pun (fetch OpenAlex, panggilan AI) dilakukan.
 */
export async function checkRateLimit(
  name: LimitName,
  request: Request,
): Promise<RateLimitResult> {
  const identifier = getClientIp(request);
  const limiter = getUpstashLimiter(name);

  if (limiter) {
    try {
      const { success, reset } = await limiter.limit(identifier);
      return success
        ? { success: true }
        : {
            success: false,
            reason: "limit_exceeded",
            retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
          };
    } catch (error) {
      // Upstash tidak bisa dihubungi. Di produksi jangan diam-diam membuka
      // pintu — tolak. Saat dev, mundur ke limiter in-memory.
      console.error("[ratelimit] Upstash error:", error);
      if (isProduction) return { success: false, reason: "not_configured" };
      return checkInMemory(name, identifier)
        ? { success: true }
        : { success: false, reason: "limit_exceeded" };
    }
  }

  if (isProduction) {
    console.error(
      "[ratelimit] UPSTASH_REDIS_REST_URL/TOKEN belum diisi di produksi — request ditolak.",
    );
    return { success: false, reason: "not_configured" };
  }

  return checkInMemory(name, identifier)
    ? { success: true }
    : { success: false, reason: "limit_exceeded" };
}

/**
 * Response 429 seragam untuk semua route (SPEC.md Bagian 2). `Retry-After`
 * berisi jeda sebenarnya dari Upstash kalau ada — kartu feed memakainya untuk
 * menunggu lalu mencoba lagi, bukan langsung menyerah.
 */
export function tooManyRequests(retryAfter = 60): Response {
  return Response.json(
    { error: "Too many requests" },
    {
      status: 429,
      // no-store: /api/summarize kini GET yang di-cache CDN — penolakan ini
      // tidak boleh ikut tersimpan dan disajikan ke user lain.
      headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
    },
  );
}

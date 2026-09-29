import { reserveAiCall } from "@/lib/ai-budget";
import { OpenAlexError, fetchWorkContent, isValidWorkId, shortWorkId } from "@/lib/openalex";
import { checkRateLimit, tooManyRequests } from "@/lib/ratelimit";
import { cacheSummary, getCachedSummary } from "@/lib/summary-cache";
import { noAbstractSummary, summarizePaper } from "@/lib/summarize";
import type { Summary } from "@/types";

/**
 * GET /api/summarize?paper_id=W123
 *
 * Satu-satunya input adalah paper_id. Client TIDAK BOLEH mengirim abstrak:
 * server mengambilnya sendiri dari OpenAlex. Kalau client boleh mengirim teks
 * bebas, endpoint ini berubah jadi proxy AI gratis (SPEC.md Bagian 2,
 * CLAUDE.md aturan #4). Parameter lain apa pun diabaikan.
 *
 * Memakai GET (bukan POST) supaya CDN Vercel bisa menyimpan ringkasan yang
 * berhasil. Ringkasan untuk satu paper sama untuk semua orang, jadi permintaan
 * berulang dilayani edge tanpa memanggil fungsi, Redis, atau AI sama sekali.
 */

/**
 * Ringkasan sukses: browser simpan 1 hari, CDN simpan 30 hari, dan setelahnya
 * boleh menyajikan versi lama 7 hari sambil memperbarui di belakang layar.
 */
const CACHE_SUCCESS = "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800";

/**
 * Error TIDAK boleh di-cache: kalau AI sedang penuh atau gagal, permintaan
 * berikutnya harus mencoba lagi, bukan menerima kegagalan basi selama 30 hari.
 */
const NO_STORE = "no-store";

/** Batas kecepatan OpenAlex berlaku per detik, jadi jeda singkat sudah cukup. */
const OPENALEX_RETRY_AFTER = 3;

function json(body: unknown, status: number, cacheControl: string): Response {
  return Response.json(body, { status, headers: { "Cache-Control": cacheControl } });
}

function success(summary: Summary): Response {
  return json(summary, 200, CACHE_SUCCESS);
}

/**
 * AI sedang tidak bisa meringkas. 503 + `retryAfter` berarti "penuh, coba lagi
 * dalam N detik" — kartunya tetap menampilkan shimmer dan mencoba lagi sendiri.
 * Tanpa `retryAfter` berarti gagal sungguhan (jatah harian habis, output model
 * rusak): client berhenti mencoba dan menampilkan judul asli.
 */
function unavailable(retryAfter: number | null): Response {
  const headers: Record<string, string> = { "Cache-Control": NO_STORE };
  if (retryAfter !== null) headers["Retry-After"] = String(retryAfter);
  return Response.json(
    { error: retryAfter !== null ? "busy" : "unavailable", retryAfter },
    { status: 503, headers },
  );
}

export async function GET(request: Request): Promise<Response> {
  const limit = await checkRateLimit("summarize", request);
  if (!limit.success) return tooManyRequests(limit.retryAfter);

  const rawId = new URL(request.url).searchParams.get("paper_id")?.trim() ?? "";
  if (!rawId) {
    return json({ error: "paper_id wajib diisi" }, 400, NO_STORE);
  }

  const paperId = shortWorkId(rawId).toUpperCase();
  if (!isValidWorkId(paperId)) {
    return json({ error: "paper_id tidak valid" }, 400, NO_STORE);
  }

  // 1. Cache Redis — lapis kedua setelah CDN.
  const cached = await getCachedSummary(paperId);
  if (cached) return success(cached);

  // 2. Ambil judul + abstrak dari OpenAlex (server-side).
  let work;
  try {
    work = await fetchWorkContent(paperId);
  } catch (error) {
    if (error instanceof OpenAlexError) {
      // OpenAlex sedang membatasi kecepatan: suruh kartu menunggu sebentar,
      // sama seperti saat jatah AI per menit penuh.
      if (error.status === 429) return unavailable(OPENALEX_RETRY_AFTER);
      console.error("[api/summarize] OpenAlex:", error.message);
      return json({ error: "Gagal mengambil paper. Coba lagi sebentar lagi." }, 502, NO_STORE);
    }
    console.error("[api/summarize] Unexpected:", error);
    return json({ error: "Terjadi kesalahan." }, 500, NO_STORE);
  }

  if (!work) {
    return json({ error: "Paper not found" }, 404, NO_STORE);
  }

  // 3. Abstrak kosong → ringkasan "tanpa abstrak", JANGAN panggil AI (SPEC.md
  //    Bagian 2). Hasilnya tidak akan berubah, jadi aman di-cache.
  if (!work.abstract.trim()) {
    return success(noAbstractSummary(work.title));
  }

  // 4. Jatah AI global: per menit (kuota Gemini) lalu per hari.
  const slot = await reserveAiCall();
  if (!slot.ok) {
    if (slot.reason === "daily") {
      console.warn(`[api/summarize] Jatah AI harian habis, ${paperId} tidak diringkas.`);
    }
    return unavailable(slot.reason === "busy" ? slot.retryAfter : null);
  }

  // 5. Panggil AI.
  const result = await summarizePaper(paperId, work.title, work.abstract);
  if (!result.ok) {
    if (result.retryAfter === null) {
      console.error(`[api/summarize] Summarization gagal untuk ${paperId}.`);
    }
    return unavailable(result.retryAfter);
  }

  // 6. Simpan ke Redis. Di-await supaya penulisan tidak terpotong saat
  //    fungsi serverless dimatikan setelah response dikirim.
  await cacheSummary(paperId, result.summary);

  return success(result.summary);
}

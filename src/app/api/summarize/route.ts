import { reserveAiCall } from "@/lib/ai-budget";
import { OpenAlexError, fetchWorkContent, isValidWorkId, shortWorkId } from "@/lib/openalex";
import { checkRateLimit, tooManyRequests } from "@/lib/ratelimit";
import { cacheSummary, getCachedSummary } from "@/lib/summary-cache";
import { fallbackSummary, summarizePaper } from "@/lib/summarize";
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
 * Fallback & error TIDAK boleh di-cache: kalau AI sedang gagal atau jatah
 * harian habis, permintaan berikutnya harus mencoba lagi, bukan menerima
 * fallback basi selama 30 hari.
 */
const NO_STORE = "no-store";

function json(body: unknown, status: number, cacheControl: string): Response {
  return Response.json(body, { status, headers: { "Cache-Control": cacheControl } });
}

function success(summary: Summary): Response {
  return json(summary, 200, CACHE_SUCCESS);
}

export async function GET(request: Request): Promise<Response> {
  const limit = await checkRateLimit("summarize", request);
  if (!limit.success) return tooManyRequests();

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
      console.error("[api/summarize] OpenAlex:", error.message);
      return json({ error: "Gagal mengambil paper. Coba lagi sebentar lagi." }, 502, NO_STORE);
    }
    console.error("[api/summarize] Unexpected:", error);
    return json({ error: "Terjadi kesalahan." }, 500, NO_STORE);
  }

  if (!work) {
    return json({ error: "Paper not found" }, 404, NO_STORE);
  }

  // 3. Abstrak kosong → fallback, JANGAN panggil AI (SPEC.md Bagian 2).
  //    Hasilnya tidak akan berubah, jadi aman di-cache seperti ringkasan sukses.
  if (!work.abstract.trim()) {
    return success(fallbackSummary(work.title));
  }

  // 4. Jatah AI harian global. Habis → fallback sementara (tidak di-cache).
  if (!(await reserveAiCall())) {
    console.warn(`[api/summarize] Jatah AI harian habis, ${paperId} memakai fallback.`);
    return json(fallbackSummary(work.title), 200, NO_STORE);
  }

  // 5. Panggil AI. Gagal → fallback sementara (tidak di-cache).
  const summary = await summarizePaper(work.title, work.abstract);
  if (!summary) {
    console.error(`[api/summarize] Summarization gagal untuk ${paperId}, memakai fallback.`);
    return json(fallbackSummary(work.title), 200, NO_STORE);
  }

  // 6. Simpan ke Redis. Di-await supaya penulisan tidak terpotong saat
  //    fungsi serverless dimatikan setelah response dikirim.
  await cacheSummary(paperId, summary);

  return success(summary);
}

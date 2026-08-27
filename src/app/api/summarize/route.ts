import { OpenAlexError, fetchWorkContent, isValidWorkId, shortWorkId } from "@/lib/openalex";
import { checkRateLimit, tooManyRequests } from "@/lib/ratelimit";
import { cacheSummary, getCachedSummary } from "@/lib/supabase";
import { fallbackSummary, summarizePaper } from "@/lib/summarize";

/**
 * POST /api/summarize
 *
 * Body: { paper_id } SAJA.
 *
 * Client TIDAK BOLEH mengirim abstrak. Server mengambil abstraknya sendiri
 * dari OpenAlex berdasarkan paper_id — kalau client boleh mengirim teks bebas,
 * endpoint ini berubah jadi proxy AI gratis yang bisa dipakai siapa saja untuk
 * merangkum apa pun (SPEC.md Bagian 2, CLAUDE.md aturan #4).
 */
export async function POST(request: Request): Promise<Response> {
  const limit = await checkRateLimit("summarize", request);
  if (!limit.success) return tooManyRequests();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body harus JSON valid" }, { status: 400 });
  }

  const rawId =
    body && typeof body === "object" && "paper_id" in body
      ? (body as { paper_id: unknown }).paper_id
      : null;

  if (typeof rawId !== "string" || !rawId.trim()) {
    return Response.json({ error: "paper_id wajib diisi" }, { status: 400 });
  }

  const paperId = shortWorkId(rawId).toUpperCase();
  if (!isValidWorkId(paperId)) {
    return Response.json({ error: "paper_id tidak valid" }, { status: 400 });
  }

  // 1. Cache dulu — summary yang sama dipakai lintas user.
  const cached = await getCachedSummary(paperId);
  if (cached) return Response.json(cached);

  // 2. Ambil judul + abstrak dari OpenAlex (server-side).
  let work;
  try {
    work = await fetchWorkContent(paperId);
  } catch (error) {
    if (error instanceof OpenAlexError) {
      console.error("[api/summarize] OpenAlex:", error.message);
      return Response.json(
        { error: "Gagal mengambil paper. Coba lagi sebentar lagi." },
        { status: 502 },
      );
    }
    console.error("[api/summarize] Unexpected:", error);
    return Response.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }

  if (!work) {
    return Response.json({ error: "Paper not found" }, { status: 404 });
  }

  // 3. Abstrak kosong → fallback anggun, JANGAN panggil AI (SPEC.md Bagian 2).
  if (!work.abstract.trim()) {
    return Response.json(fallbackSummary(work.title));
  }

  // 4. Panggil AI. Gagal (timeout, JSON invalid setelah retry, key kosong)
  //    juga jatuh ke fallback yang sama — user tetap dapat sesuatu.
  const summary = await summarizePaper(work.title, work.abstract);
  if (!summary) {
    console.error(`[api/summarize] Summarization gagal untuk ${paperId}, memakai fallback.`);
    return Response.json(fallbackSummary(work.title));
  }

  // 5. Simpan ke cache. Sengaja di-await supaya penulisan tidak terpotong saat
  //    fungsi serverless dimatikan setelah response dikirim.
  await cacheSummary({
    paperId,
    title: work.title,
    summary,
    abstract: work.abstract,
  });

  return Response.json(summary);
}

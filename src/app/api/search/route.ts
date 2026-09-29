import { OpenAlexError, searchPapers, type SearchResult } from "@/lib/openalex";
import { expandQuery } from "@/lib/query-expand";
import { checkRateLimit, tooManyRequests } from "@/lib/ratelimit";
import { getCachedSummaries } from "@/lib/summary-cache";
import type { Paper, SearchResponse } from "@/types";

/** OpenAlex menolak query sangat panjang; potong sebelum dikirim. */
const MAX_QUERY_LENGTH = 200;

/**
 * Hasil search sama untuk semua orang, jadi CDN boleh menyimpannya. Kecuali
 * saat perluasan query gagal karena AI sedang penuh: hasil tanpa versi bahasa
 * Inggris itu tidak boleh menempel satu jam di CDN.
 */
const CACHE_SHARED = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
const NO_STORE = "no-store";

/**
 * Gabungkan hasil query bahasa Inggris dan query asli: dua dari bahasa
 * Inggris, lalu satu dari query asli, dan seterusnya. Versi Inggris menangkap
 * MAKSUD query ("kenapa susah tidur" → insomnia), jadi porsinya lebih besar;
 * query asli tetap memunculkan jurnal lokal Indonesia yang cocok kata per kata.
 * Porsi 1:1 sempat dicoba, tapi untuk query berbentuk pertanyaan hasil literal
 * sering tidak nyambung dan muncul di setiap slot kedua. Skor relevansi dua
 * query berbeda tidak bisa dibandingkan, jadi keduanya tidak diurut ulang.
 */
function interleave(english: Paper[], literal: Paper[]): Paper[] {
  const seen = new Set<string>();
  const result: Paper[] = [];
  const push = (paper: Paper | undefined) => {
    if (paper && !seen.has(paper.id)) {
      seen.add(paper.id);
      result.push(paper);
    }
  };

  let e = 0;
  let l = 0;
  while (e < english.length || l < literal.length) {
    push(english[e++]);
    push(english[e++]);
    push(literal[l++]);
  }
  return result;
}

export async function GET(request: Request): Promise<Response> {
  const limit = await checkRateLimit("search", request);
  if (!limit.success) return tooManyRequests();

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  if (!query) {
    const empty: SearchResponse = { papers: [], nextPage: null, expandedLabel: null };
    return Response.json(empty);
  }

  const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const expansion = await expandQuery(query);
  const expanded = expansion.status === "expanded" ? expansion.expansion : null;

  const [literal, english] = await Promise.allSettled([
    searchPapers(query, page),
    expanded ? searchPapers(expanded.query, page) : Promise.resolve<SearchResult | null>(null),
  ]);

  // Query bahasa Inggris gagal (mis. sintaks yang tetap ditolak OpenAlex)?
  // Tidak apa — hasil query asli tetap dikirim.
  const englishResult = english.status === "fulfilled" ? english.value : null;

  if (literal.status === "rejected" && !englishResult) {
    const error = literal.reason;
    if (error instanceof OpenAlexError) {
      console.error("[api/search] OpenAlex:", error.message);
      return Response.json(
        { error: "Pencarian gagal. Coba lagi sebentar lagi." },
        { status: 502, headers: { "Cache-Control": NO_STORE } },
      );
    }
    console.error("[api/search] Unexpected:", error);
    return Response.json(
      { error: "Terjadi kesalahan." },
      { status: 500, headers: { "Cache-Control": NO_STORE } },
    );
  }

  const literalResult = literal.status === "fulfilled" ? literal.value : null;

  const papers = interleave(englishResult?.papers ?? [], literalResult?.papers ?? []);
  const body: SearchResponse = {
    papers,
    nextPage:
      literalResult?.nextPage != null || englishResult?.nextPage != null ? page + 1 : null,
    // Label yang sama dengan ketikan user (query sudah bahasa Inggris) tidak
    // memberi informasi apa pun — jangan ditampilkan.
    expandedLabel:
      englishResult && expanded && expanded.label.toLowerCase() !== query.toLowerCase()
        ? expanded.label
        : null,
    summaries: await getCachedSummaries(papers.map((p) => p.id)),
  };

  const complete =
    expansion.status !== "unavailable" &&
    literal.status === "fulfilled" &&
    (!expanded || english.status === "fulfilled");
  return Response.json(body, {
    headers: { "Cache-Control": complete ? CACHE_SHARED : NO_STORE },
  });
}

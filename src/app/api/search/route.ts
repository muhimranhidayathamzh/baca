import { OpenAlexError, searchPapers } from "@/lib/openalex";
import { checkRateLimit, tooManyRequests } from "@/lib/ratelimit";
import type { SearchResponse } from "@/types";

/** OpenAlex menolak query sangat panjang; potong sebelum dikirim. */
const MAX_QUERY_LENGTH = 200;

export async function GET(request: Request): Promise<Response> {
  const limit = await checkRateLimit("search", request);
  if (!limit.success) return tooManyRequests();

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  if (!query) {
    const empty: SearchResponse = { papers: [], nextPage: null };
    return Response.json(empty);
  }

  const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  try {
    const result = await searchPapers(query, page);
    const body: SearchResponse = {
      papers: result.papers,
      nextPage: result.nextPage,
    };
    return Response.json(body);
  } catch (error) {
    if (error instanceof OpenAlexError) {
      console.error("[api/search] OpenAlex:", error.message);
      return Response.json(
        { error: "Pencarian gagal. Coba lagi sebentar lagi." },
        { status: 502 },
      );
    }
    console.error("[api/search] Unexpected:", error);
    return Response.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

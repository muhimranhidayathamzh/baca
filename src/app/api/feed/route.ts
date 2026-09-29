import { OpenAlexError, fetchFeed, isTopicName } from "@/lib/openalex";
import { checkRateLimit, tooManyRequests } from "@/lib/ratelimit";
import { getCachedSummaries } from "@/lib/summary-cache";
import type { FeedMode, FeedResponse } from "@/types";

/**
 * Halaman feed identik untuk semua orang pada topik+mode+cursor yang sama —
 * riwayat baca disaring di browser, bukan di sini — jadi CDN Vercel boleh
 * menyajikannya. User kedua yang membuka topik yang sama mendapat feed dari
 * edge tanpa menunggu OpenAlex sama sekali.
 *
 * 30 menit segar, lalu sehari boleh disajikan basi sambil diperbarui di
 * belakang layar. Urutan sitasi OpenAlex berubah jauh lebih lambat dari itu.
 */
const CACHE_SHARED = "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400";

/**
 * Halaman pertama Explore tanpa seed memilih seed acak di server. Kalau
 * di-cache, semua orang mendapat "acak" yang sama — jadi hanya untuk browser
 * ini. Halaman berikutnya membawa seed di URL-nya dan aman di-cache bersama.
 */
const CACHE_PRIVATE = "private, max-age=0";

const NO_STORE = "no-store";

export async function GET(request: Request): Promise<Response> {
  const limit = await checkRateLimit("feed", request);
  if (!limit.success) return tooManyRequests();

  const { searchParams } = new URL(request.url);

  const topicParam = searchParams.get("topic")?.trim() ?? "";
  const topic = topicParam && isTopicName(topicParam) ? topicParam : null;
  if (topicParam && !topic) {
    return Response.json(
      { error: "Topik tidak dikenal" },
      { status: 400, headers: { "Cache-Control": NO_STORE } },
    );
  }

  const modeParam = searchParams.get("mode")?.trim();
  const mode: FeedMode = modeParam === "explore" ? "explore" : "fokus";

  const seedParam = searchParams.get("seed");
  const parsedSeed = seedParam ? Number.parseInt(seedParam, 10) : Number.NaN;
  const seed = Number.isFinite(parsedSeed) ? parsedSeed : undefined;

  try {
    const result = await fetchFeed({
      topic,
      mode,
      cursor: searchParams.get("cursor") ?? undefined,
      seed,
    });

    const summaries = await getCachedSummaries(result.papers.map((p) => p.id));

    const body: FeedResponse = {
      papers: result.papers,
      nextCursor: result.nextCursor,
      ...(result.seed !== undefined ? { seed: result.seed } : {}),
      summaries,
    };

    const cacheControl = mode === "explore" && seed === undefined ? CACHE_PRIVATE : CACHE_SHARED;
    return Response.json(body, { headers: { "Cache-Control": cacheControl } });
  } catch (error) {
    if (error instanceof OpenAlexError) {
      // Batas kecepatan OpenAlex (per detik / per hari): kondisi sementara.
      if (error.status === 429) {
        return Response.json(
          { error: "Sumber data sedang sibuk. Coba lagi sebentar lagi." },
          { status: 503, headers: { "Cache-Control": NO_STORE, "Retry-After": "2" } },
        );
      }
      console.error("[api/feed] OpenAlex:", error.message);
      return Response.json(
        { error: "Gagal mengambil feed. Coba lagi sebentar lagi." },
        { status: error.status === 404 ? 404 : 502, headers: { "Cache-Control": NO_STORE } },
      );
    }
    console.error("[api/feed] Unexpected:", error);
    return Response.json(
      { error: "Terjadi kesalahan." },
      { status: 500, headers: { "Cache-Control": NO_STORE } },
    );
  }
}

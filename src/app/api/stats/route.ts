import { timingSafeEqual } from "node:crypto";
import { readWeeklyMetrics } from "@/lib/metrics";
import { checkRateLimit, tooManyRequests } from "@/lib/ratelimit";

/**
 * GET /api/stats — dua metrik utama untuk pemilik proyek, 4 minggu terakhir.
 *
 * Pakai header `Authorization: Bearer <STATS_TOKEN>`. Kalau STATS_TOKEN tidak
 * diisi, endpoint ini berpura-pura tidak ada (404) supaya tidak ada pintu yang
 * terbuka tanpa kunci.
 */

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // Perbandingan waktu-konstan: mencegah token ditebak lewat selisih waktu respons.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.STATS_TOKEN?.trim();
  if (!expected) return new Response(null, { status: 404 });

  const limit = await checkRateLimit("stats", request);
  if (!limit.success) return tooManyRequests();

  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!given || !tokenMatches(given, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const weeks = await readWeeklyMetrics(4);
  if (!weeks) {
    return Response.json(
      { error: "Upstash belum dikonfigurasi" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json({ weeks }, { headers: { "Cache-Control": "no-store" } });
}

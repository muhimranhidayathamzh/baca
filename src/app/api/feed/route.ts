import {
  OpenAlexError,
  fetchFeed,
  isTopicName,
  shortWorkId,
} from "@/lib/openalex";
import { checkRateLimit, tooManyRequests } from "@/lib/ratelimit";
import type { FeedMode, FeedResponse } from "@/types";

/** Batas jumlah paper_id di `exclude`, supaya URL tidak meledak seiring
 *  read_history tumbuh. Yang dipakai adalah yang paling baru dibaca. */
const MAX_EXCLUDE = 100;

export async function GET(request: Request): Promise<Response> {
  const limit = await checkRateLimit("feed", request);
  if (!limit.success) return tooManyRequests();

  const { searchParams } = new URL(request.url);

  const topicParam = searchParams.get("topic")?.trim() ?? "";
  const topic = topicParam && isTopicName(topicParam) ? topicParam : null;
  if (topicParam && !topic) {
    return Response.json({ error: "Topik tidak dikenal" }, { status: 400 });
  }

  const modeParam = searchParams.get("mode")?.trim();
  const mode: FeedMode = modeParam === "explore" ? "explore" : "fokus";

  const exclude = (searchParams.get("exclude") ?? "")
    .split(",")
    .map((id) => shortWorkId(id.trim()))
    .filter(Boolean)
    .slice(-MAX_EXCLUDE);

  const seedParam = searchParams.get("seed");
  const seed = seedParam ? Number.parseInt(seedParam, 10) : undefined;

  try {
    const result = await fetchFeed({
      topic,
      mode,
      cursor: searchParams.get("cursor") ?? undefined,
      exclude,
      seed: Number.isFinite(seed) ? seed : undefined,
    });

    const body: FeedResponse = {
      papers: result.papers,
      nextCursor: result.nextCursor,
      ...(result.seed !== undefined ? { seed: result.seed } : {}),
    };

    return Response.json(body);
  } catch (error) {
    if (error instanceof OpenAlexError) {
      console.error("[api/feed] OpenAlex:", error.message);
      return Response.json(
        { error: "Gagal mengambil feed. Coba lagi sebentar lagi." },
        { status: error.status === 404 ? 404 : 502 },
      );
    }
    console.error("[api/feed] Unexpected:", error);
    return Response.json({ error: "Terjadi kesalahan." }, { status: 500 });
  }
}

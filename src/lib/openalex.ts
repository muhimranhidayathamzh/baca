import { abstractFromInverted, estimateReadingMinutes, type InvertedIndex } from "./abstract";
import { rerankBalanced } from "./rerank";
import type { FeedMode, Paper, TopicName } from "@/types";

const OPENALEX_BASE = "https://api.openalex.org";

/**
 * Email untuk "polite pool" OpenAlex — memberi kuota & prioritas lebih baik
 * daripada anonim. Selalu dikirim, terlepas dari ada tidaknya API key.
 */
const POLITE_MAILTO = "imranhdayat@gmail.com";

/** Paper harus terbit tahun ini atau sesudahnya (SPEC.md: filter 2022+). */
const MIN_PUBLICATION_YEAR = 2022;

/** Jumlah paper yang dikembalikan ke client per halaman (SPEC.md Bagian 2). */
export const PAGE_SIZE = 20;

/**
 * Ambil lebih banyak kandidat daripada yang dikembalikan, supaya masih tersisa
 * cukup paper setelah `exclude` (read history) membuang sebagian.
 */
const CANDIDATE_SIZE = 25;

/** Batas maksimum `sample` OpenAlex — terverifikasi live (>10.000 ditolak). */
const MAX_SAMPLE = 10_000;

/**
 * Pemetaan topik Indonesia → field OpenAlex (SPEC.md Bagian 6).
 * ID diverifikasi terhadap endpoint /fields yang live.
 */
const TOPIC_TO_FIELD: Record<TopicName, string> = {
  Kesehatan: "fields/27", // Medicine
  AI: "fields/17", // Computer Science
  Neurosains: "fields/28", // Neuroscience
  Lingkungan: "fields/23", // Environmental Science
  Psikologi: "fields/32", // Psychology
  Ekonomi: "fields/20", // Economics, Econometrics and Finance
};

const FIELD_TO_TOPIC: Record<string, TopicName> = Object.fromEntries(
  Object.entries(TOPIC_TO_FIELD).map(([topic, field]) => [field, topic as TopicName]),
) as Record<string, TopicName>;

export const TOPICS = Object.keys(TOPIC_TO_FIELD) as TopicName[];

export function isTopicName(value: string): value is TopicName {
  return value in TOPIC_TO_FIELD;
}

/** Field yang diminta dari OpenAlex. Membatasi payload = respons lebih cepat. */
const FEED_SELECT = [
  "id",
  "doi",
  "display_name",
  "publication_year",
  "cited_by_count",
  "primary_topic",
  "primary_location",
  "authorships",
  "abstract_inverted_index",
].join(",");

/** Bentuk mentah work dari OpenAlex — hanya field yang benar-benar dipakai. */
interface OpenAlexWork {
  id?: string;
  doi?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  cited_by_count?: number | null;
  primary_topic?: { field?: { id?: string | null } | null } | null;
  primary_location?: { source?: { display_name?: string | null } | null } | null;
  authorships?: Array<{ author?: { display_name?: string | null } | null }> | null;
  abstract_inverted_index?: InvertedIndex | null;
}

interface OpenAlexResponse {
  meta?: { next_cursor?: string | null; count?: number };
  results?: OpenAlexWork[];
  error?: string;
  message?: string;
}

/** Error dengan status HTTP supaya route bisa meneruskan kode yang tepat. */
export class OpenAlexError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OpenAlexError";
  }
}

/**
 * Ubah OpenAlex work ID jadi bentuk pendek: "https://openalex.org/W123" → "W123".
 * Dipakai konsisten sebagai paper_id di seluruh app (localStorage, Supabase).
 */
export function shortWorkId(id: string): string {
  return id.replace(/^https?:\/\/openalex\.org\//i, "").trim();
}

/** Validasi bentuk paper_id sebelum dipakai membangun URL ke OpenAlex. */
export function isValidWorkId(id: string): boolean {
  return /^W\d+$/i.test(id);
}

function buildUrl(path: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(`${OPENALEX_BASE}${path}`);
  url.searchParams.set("mailto", POLITE_MAILTO);

  // API key hanya dikirim kalau benar-benar terisi: OpenAlex menolak key
  // kosong/ngawur dengan HTTP 401, jadi mengirim string kosong justru
  // mematikan request yang sebetulnya bisa jalan lewat polite pool.
  const apiKey = process.env.OPENALEX_API_KEY?.trim();
  if (apiKey) url.searchParams.set("api_key", apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function fetchOpenAlex(url: string): Promise<OpenAlexResponse> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      // Data OpenAlex berubah lambat; cache 5 menit menekan jumlah panggilan
      // (kuota polite pool hanya 1.000 kredit/hari per IP).
      next: { revalidate: 300 },
    });
  } catch {
    throw new OpenAlexError("Tidak bisa menghubungi OpenAlex", 503);
  }

  if (!response.ok) {
    throw new OpenAlexError(
      `OpenAlex membalas ${response.status}`,
      response.status === 404 ? 404 : 502,
    );
  }

  const data = (await response.json()) as OpenAlexResponse;
  if (data.error) {
    throw new OpenAlexError(data.message || data.error, 502);
  }
  return data;
}

function normalizeWork(work: OpenAlexWork): Paper | null {
  if (!work.id) return null;

  const abstract = abstractFromInverted(work.abstract_inverted_index);
  const fieldId = work.primary_topic?.field?.id
    ? shortWorkId(work.primary_topic.field.id)
    : null;

  const authors = (work.authorships ?? [])
    .map((a) => a.author?.display_name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);

  return {
    id: shortWorkId(work.id),
    title: work.display_name?.trim() || "Tanpa judul",
    year: work.publication_year ?? null,
    citations: work.cited_by_count ?? 0,
    venue: work.primary_location?.source?.display_name?.trim() || null,
    authors,
    url: work.doi || work.id,
    topic: fieldId ? (FIELD_TO_TOPIC[fieldId] ?? null) : null,
    readingMinutes: estimateReadingMinutes(abstract),
    hasAbstract: abstract.length > 0,
  };
}

/**
 * Filter dasar yang dipakai feed maupun search.
 *
 * Memakai `primary_topic.field.id`, bukan `topics.field.id` seperti draft awal
 * SPEC: `topics` mencakup topik sekunder sehingga paper salah-klasifikasi
 * bocor ke feed (terverifikasi live — top-6 Medicine memunculkan paper IoT
 * lalu lintas kota). `primary_topic` jauh lebih presisi.
 */
function buildFilter(topic: TopicName | null): string {
  const parts = [
    `publication_year:>${MIN_PUBLICATION_YEAR - 1}`,
    "is_oa:true",
    "type:article",
    // Hanya paper yang punya abstrak — tanpa abstrak, tidak ada yang bisa
    // dirangkum dan kartunya jadi kosong.
    "has_abstract:true",
  ];
  if (topic) parts.unshift(`primary_topic.field.id:${TOPIC_TO_FIELD[topic]}`);
  return parts.join(",");
}

export interface FeedParams {
  topic: TopicName | null;
  mode: FeedMode;
  /** Cursor OpenAlex (mode fokus) atau nomor halaman (mode explore). */
  cursor?: string;
  /** paper_id yang sudah dibaca dan tidak boleh muncul lagi. */
  exclude?: string[];
  /** Seed acak mode explore, supaya paginasi konsisten antar request. */
  seed?: number;
}

export interface FeedResult {
  papers: Paper[];
  nextCursor: string | null;
  seed?: number;
}

/**
 * Ambil satu halaman feed.
 *
 * Mode fokus  : sort cited_by_count:desc + cursor pagination, lalu re-rank
 *               seimbang di dalam batch.
 * Mode explore: sample + seed acak untuk serendipity. `sample` TIDAK
 *               kompatibel dengan cursor (terverifikasi live: next_cursor
 *               selalu null dan cursor-nya ditolak), jadi paginasinya memakai
 *               nomor halaman biasa. Hasil sample sudah acak — tidak di-re-rank
 *               supaya keacakannya tidak dirusak.
 */
export async function fetchFeed(params: FeedParams): Promise<FeedResult> {
  const { topic, mode, exclude = [], cursor } = params;
  const filter = buildFilter(topic);
  const excluded = new Set(exclude);

  if (mode === "explore") {
    const seed = params.seed ?? Math.floor(Math.random() * 1_000_000);
    const page = Math.max(1, Number.parseInt(cursor ?? "1", 10) || 1);

    const data = await fetchOpenAlex(
      buildUrl("/works", {
        filter,
        select: FEED_SELECT,
        sample: MAX_SAMPLE,
        seed,
        page,
        "per-page": CANDIDATE_SIZE,
      }),
    );

    const papers = (data.results ?? [])
      .map(normalizeWork)
      .filter((p): p is Paper => p !== null && !excluded.has(p.id))
      .slice(0, PAGE_SIZE);

    // Sample punya batas 10.000 hasil; berhenti kalau halaman sudah habis
    // atau kalau OpenAlex mengembalikan kurang dari yang diminta.
    const exhausted =
      (data.results?.length ?? 0) < CANDIDATE_SIZE || page * CANDIDATE_SIZE >= MAX_SAMPLE;

    return {
      papers,
      nextCursor: exhausted ? null : String(page + 1),
      seed,
    };
  }

  const data = await fetchOpenAlex(
    buildUrl("/works", {
      filter,
      select: FEED_SELECT,
      sort: "cited_by_count:desc",
      cursor: cursor || "*",
      "per-page": CANDIDATE_SIZE,
    }),
  );

  const candidates = (data.results ?? [])
    .map(normalizeWork)
    .filter((p): p is Paper => p !== null && !excluded.has(p.id));

  const papers = rerankBalanced(candidates).slice(0, PAGE_SIZE);
  const nextCursor = data.meta?.next_cursor ?? null;

  return {
    papers,
    // OpenAlex mengembalikan cursor yang sama saat hasil sudah habis; hentikan
    // paginasi supaya infinite scroll di client tidak berputar selamanya.
    nextCursor: data.results?.length ? nextCursor : null,
  };
}

export interface SearchResult {
  papers: Paper[];
  nextPage: number | null;
}

/** Cari paper lewat endpoint search OpenAlex (SPEC.md Bagian 2, /api/search). */
export async function searchPapers(query: string, page = 1): Promise<SearchResult> {
  const safePage = Math.max(1, page);
  const data = await fetchOpenAlex(
    buildUrl("/works", {
      search: query,
      filter: buildFilter(null),
      select: FEED_SELECT,
      page: safePage,
      "per-page": PAGE_SIZE,
    }),
  );

  const papers = (data.results ?? [])
    .map(normalizeWork)
    .filter((p): p is Paper => p !== null);

  return {
    papers,
    nextPage: papers.length < PAGE_SIZE ? null : safePage + 1,
  };
}

export interface WorkContent {
  id: string;
  title: string;
  abstract: string;
}

/**
 * Ambil judul + abstrak satu paper. Dipakai /api/summarize supaya abstrak
 * datang dari server, bukan dari client (SPEC.md Bagian 2: endpoint tidak
 * boleh bisa dibajak jadi proxy AI umum).
 *
 * Mengembalikan null kalau paper tidak ada di OpenAlex.
 */
export async function fetchWorkContent(workId: string): Promise<WorkContent | null> {
  if (!isValidWorkId(workId)) return null;

  let data: OpenAlexWork;
  try {
    data = (await fetchOpenAlex(
      buildUrl(`/works/${workId.toUpperCase()}`, {
        select: "id,display_name,abstract_inverted_index",
      }),
    )) as OpenAlexWork;
  } catch (error) {
    if (error instanceof OpenAlexError && error.status === 404) return null;
    throw error;
  }

  if (!data?.id) return null;

  return {
    id: shortWorkId(data.id),
    title: data.display_name?.trim() || "Tanpa judul",
    abstract: abstractFromInverted(data.abstract_inverted_index),
  };
}

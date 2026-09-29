import "server-only";
import { abstractFromInverted, estimateReadingMinutes, type InvertedIndex } from "./abstract";
import { rerankBalanced } from "./rerank";
import { TOPIC_TO_FIELD } from "./topics";
import type { FeedMode, Paper, TopicName } from "@/types";

export { TOPICS, isTopicName } from "./topics";

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
 * Jumlah paper per halaman feed. Lebih dari 20 kartu yang ditampilkan per
 * batch: riwayat baca sekarang disaring di browser (lihat hooks/useFeed.ts),
 * jadi server mengirim sedikit cadangan untuk paper yang akan terbuang.
 */
const FEED_PAGE_SIZE = 25;

/**
 * Mode Fokus = dua aliran yang digabung per halaman:
 * - "berpengaruh": sitasi terbanyak sejak 2022
 * - "baru naik"  : terbit tahun lalu atau tahun ini, diurut sitasi
 *
 * Tanpa aliran kedua, paper yang benar-benar baru hampir tidak pernah muncul:
 * re-rank 60/40 hanya bekerja di dalam satu halaman, dan halaman urutan sitasi
 * sudah diisi paper lama yang sitasinya ribuan.
 */
const FOKUS_ESTABLISHED_SIZE = 15;
const FOKUS_RISING_SIZE = 10;

/** Pemisah dua cursor di dalam satu cursor Fokus. Tidak ada di alfabet base64. */
const CURSOR_SEPARATOR = "~";

/** Batas maksimum `sample` OpenAlex — terverifikasi live (>10.000 ditolak). */
const MAX_SAMPLE = 10_000;

const FIELD_TO_TOPIC: Record<string, TopicName> = Object.fromEntries(
  Object.entries(TOPIC_TO_FIELD).map(([topic, field]) => [field, topic as TopicName]),
) as Record<string, TopicName>;

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
 * Dipakai konsisten sebagai paper_id di seluruh app (localStorage, cache Redis).
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
    // 429 diteruskan apa adanya: itu batas kecepatan (±10 request/detik tanpa
    // API key), kondisi sementara yang pemanggil bisa tunggu — bukan error.
    const status = response.status === 404 || response.status === 429 ? response.status : 502;
    throw new OpenAlexError(`OpenAlex membalas ${response.status}`, status);
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
function buildFilter(topic: TopicName | null, { forFeed }: { forFeed: boolean }): string {
  const parts = [
    `publication_year:>${MIN_PUBLICATION_YEAR - 1}`,
    "is_oa:true",
    "type:article",
    // Hanya paper yang punya abstrak — tanpa abstrak, tidak ada yang bisa
    // dirangkum dan kartunya jadi kosong.
    "has_abstract:true",
  ];
  if (topic) parts.unshift(`primary_topic.field.id:${TOPIC_TO_FIELD[topic]}`);

  // Buang record korup dari FEED. Feed diurut sitasi, jadi record rusak
  // dengan sitasi melambung langsung naik ke puncak — terverifikasi live:
  // paper arkeologi Zaman Batu muncul di urutan kedua feed Kesehatan dengan
  // 24.109 sitasi tapi 0 referensi, tanda record yang tergabung/korup. Artikel
  // riset sungguhan hampir tidak pernah tanpa daftar pustaka.
  //
  // Sengaja TIDAK dipakai di search: banyak jurnal lokal Indonesia terindeks
  // tanpa referensi yang ter-parse, dan filter ini akan membuang mereka.
  if (forFeed) parts.push("referenced_works_count:>0");

  // Hanya versi terbitan jurnal/konferensi. Paper lama yang diunggah ulang ke
  // repositori mendapat DOI & tahun baru dan membawa seluruh sitasinya —
  // terverifikasi live: "Learning Multiple Layers of Features from Tiny
  // Images" (2009) muncul sebagai paper 2024 di puncak feed AI, begitu juga
  // Kaldi (2011). Filter ini membuang keduanya dan hanya mengurangi <1% paper.
  if (forFeed) parts.push("primary_location.source.type:journal|conference");

  return parts.join(",");
}

/** Filter aliran "baru naik": sama dengan feed, tapi hanya tahun lalu dan tahun ini. */
function risingFilter(topic: TopicName | null): string {
  const fromYear = new Date().getUTCFullYear() - 1;
  return buildFilter(topic, { forFeed: true }).replace(
    `publication_year:>${MIN_PUBLICATION_YEAR - 1}`,
    `publication_year:>${fromYear - 1}`,
  );
}

export interface FeedParams {
  topic: TopicName | null;
  mode: FeedMode;
  /** Cursor Fokus (dua cursor OpenAlex digabung) atau nomor halaman (Explore). */
  cursor?: string;
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
 * Tidak ada lagi penyaringan riwayat baca di sini: hasil untuk topik+mode+cursor
 * yang sama identik untuk semua orang, jadi bisa disajikan dari CDN. Riwayat
 * baca disaring di browser dan tidak pernah meninggalkan perangkat user.
 *
 * Mode fokus  : dua aliran (berpengaruh + baru naik) diselang-seling. Aliran
 *               berpengaruh tetap di-re-rank seimbang 60/40 seperti SPEC.
 * Mode explore: sample + seed acak untuk serendipity. `sample` TIDAK
 *               kompatibel dengan cursor (terverifikasi live: next_cursor
 *               selalu null dan cursor-nya ditolak), jadi paginasinya memakai
 *               nomor halaman biasa. Tidak di-re-rank supaya keacakannya utuh.
 */
export async function fetchFeed(params: FeedParams): Promise<FeedResult> {
  const { topic, mode, cursor } = params;

  if (mode === "explore") {
    const seed = params.seed ?? Math.floor(Math.random() * 1_000_000);
    const page = Math.max(1, Number.parseInt(cursor ?? "1", 10) || 1);

    const data = await fetchOpenAlex(
      buildUrl("/works", {
        filter: buildFilter(topic, { forFeed: true }),
        select: FEED_SELECT,
        sample: MAX_SAMPLE,
        seed,
        page,
        "per-page": FEED_PAGE_SIZE,
      }),
    );

    const papers = (data.results ?? [])
      .map(normalizeWork)
      .filter((p): p is Paper => p !== null);

    // Sample punya batas 10.000 hasil; berhenti kalau halaman sudah habis
    // atau kalau OpenAlex mengembalikan kurang dari yang diminta.
    const exhausted =
      (data.results?.length ?? 0) < FEED_PAGE_SIZE || page * FEED_PAGE_SIZE >= MAX_SAMPLE;

    return {
      papers,
      nextCursor: exhausted ? null : String(page + 1),
      seed,
    };
  }

  // Cursor Fokus berbentuk "<berpengaruh>~<baru naik>". Bagian kosong berarti
  // aliran itu sudah habis. Cursor tanpa pemisah (dari versi app sebelumnya)
  // diperlakukan sebagai aliran berpengaruh saja.
  const [establishedCursor = "*", risingCursor = cursor ? "" : "*"] = (cursor ?? "*~*").split(
    CURSOR_SEPARATOR,
  );

  const fetchStream = async (filter: string, streamCursor: string, size: number) => {
    if (!streamCursor) return { papers: [] as Paper[], next: "" };
    const data = await fetchOpenAlex(
      buildUrl("/works", {
        filter,
        select: FEED_SELECT,
        sort: "cited_by_count:desc",
        cursor: streamCursor,
        "per-page": size,
      }),
    );
    const results = data.results ?? [];
    return {
      papers: results.map(normalizeWork).filter((p): p is Paper => p !== null),
      // OpenAlex mengembalikan cursor yang sama saat hasil sudah habis; tandai
      // habis supaya infinite scroll di client tidak berputar selamanya.
      next: results.length < size ? "" : (data.meta?.next_cursor ?? ""),
    };
  };

  const [established, rising] = await Promise.all([
    fetchStream(buildFilter(topic, { forFeed: true }), establishedCursor, FOKUS_ESTABLISHED_SIZE),
    fetchStream(risingFilter(topic), risingCursor, FOKUS_RISING_SIZE),
  ]);

  const bothDone = !established.next && !rising.next;
  return {
    papers: interleave(rerankBalanced(established.papers), rising.papers),
    nextCursor: bothDone ? null : `${established.next}${CURSOR_SEPARATOR}${rising.next}`,
  };
}

/**
 * Selang-seling dua aliran sesuai proporsinya (15:10 → pola 3:2), dan buang
 * duplikat — paper baru yang sitasinya sudah tinggi bisa ada di keduanya.
 *
 * Sengaja TIDAK me-re-rank gabungannya: dengan rumus 60/40, seluruh paper
 * aliran "baru naik" menang skor kebaruan dan menggumpal di atas, lalu paper
 * berpengaruh menumpuk di bawah (terverifikasi: 10 paper 2025 berturut-turut).
 * Selang-seling membuat keduanya terasa bercampur di sepanjang feed.
 */
function interleave(established: Paper[], rising: Paper[]): Paper[] {
  const ratio = FOKUS_ESTABLISHED_SIZE / FOKUS_RISING_SIZE;
  const seen = new Set<string>();
  const result: Paper[] = [];
  const push = (paper: Paper | undefined) => {
    if (paper && !seen.has(paper.id)) {
      seen.add(paper.id);
      result.push(paper);
    }
  };

  let e = 0;
  let r = 0;
  while (e < established.length || r < rising.length) {
    // Ambil dari aliran yang paling "tertinggal" dari proporsinya.
    const takeEstablished =
      r >= rising.length || (e < established.length && e <= r * ratio);
    push(takeEstablished ? established[e++] : rising[r++]);
  }
  return result;
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
      filter: buildFilter(null, { forFeed: false }),
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

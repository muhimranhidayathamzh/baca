/** Topik yang tersedia di MVP (SPEC.md Bagian 4.1). */
export type TopicName =
  | "Kesehatan"
  | "AI"
  | "Neurosains"
  | "Lingkungan"
  | "Psikologi"
  | "Ekonomi";

/** Mode feed (SPEC.md Bagian 4.2). */
export type FeedMode = "fokus" | "explore";

/**
 * Paper yang dikirim ke client. Sengaja ramping — hanya yang dipakai kartu
 * feed & reading view, supaya payload kecil (Standar Kualitas: FCP < 1.5s).
 *
 * Catatan: `abstract` TIDAK pernah ikut dikirim ke client. Abstrak hanya
 * dipakai server-side di /api/summarize, yang mengambilnya sendiri dari
 * OpenAlex berdasarkan paper_id (SPEC.md Bagian 2 — mencegah endpoint
 * dibajak jadi proxy AI).
 */
export interface Paper {
  /** OpenAlex work ID bentuk pendek, mis. "W4385245566". */
  id: string;
  title: string;
  /** Tahun terbit. */
  year: number | null;
  /** Jumlah sitasi menurut OpenAlex. */
  citations: number;
  /** Nama jurnal/venue, kalau ada. */
  venue: string | null;
  /** Nama penulis (maks 3 pertama + penanda "dkk" ditangani di UI). */
  authors: string[];
  /** Tautan ke paper asli: DOI kalau ada, kalau tidak URL OpenAlex. */
  url: string;
  /** Topik Indonesia hasil pemetaan balik dari field OpenAlex. */
  topic: TopicName | null;
  /** Estimasi waktu baca abstrak dalam menit (dihitung server-side). */
  readingMinutes: number;
  /** Apakah paper punya abstrak — kartu tanpa abstrak tidak perlu di-summarize. */
  hasAbstract: boolean;
}

/** Hasil ringkasan AI (SPEC.md Bagian 5). */
export interface Summary {
  /** Pertanyaan hook dalam Bahasa Indonesia, maks 12 kata. */
  hook: string;
  /** Frasa 2-4 kata dari hook untuk di-underline. Substring persis dari hook. */
  key: string | null;
  /** 3 kalimat: konteks/metode, temuan utama, batasan/implikasi. */
  quick: string[];
  /** 2-3 kalimat rangkuman lebih dalam. */
  deep: string;
}

/** Response /api/feed. */
export interface FeedResponse {
  papers: Paper[];
  /**
   * Penanda halaman berikutnya. Mode fokus memakai cursor OpenAlex, mode
   * explore memakai nomor halaman — `sample` OpenAlex tidak kompatibel
   * dengan cursor (terverifikasi live, lihat SPEC.md Bagian 6).
   * `null` berarti sudah habis.
   */
  nextCursor: string | null;
  /** Seed acak mode explore, dikirim balik supaya paginasi tetap konsisten. */
  seed?: number;
}

/** Response /api/search. */
export interface SearchResponse {
  papers: Paper[];
  nextPage: number | null;
}

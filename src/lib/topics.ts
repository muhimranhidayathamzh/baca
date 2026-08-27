import type { TopicName } from "@/types";

/**
 * Warna topik (SPEC.md Bagian 3) — dipakai HANYA sebagai titik kecil di kartu,
 * bukan badge warna-warni. Aksen app tetap satu: amber.
 *
 * Nilainya dirujuk lewat CSS variable, bukan class Tailwind dinamis, karena
 * Tailwind memindai kode sebagai teks — class yang dirakit saat runtime
 * (`bg-topic-${topic}`) tidak akan ikut ter-generate.
 */
export const TOPIC_DOT_COLOR: Record<TopicName, string> = {
  Kesehatan: "var(--color-topic-kesehatan)",
  AI: "var(--color-topic-ai)",
  Neurosains: "var(--color-topic-neurosains)",
  Lingkungan: "var(--color-topic-lingkungan)",
  Psikologi: "var(--color-topic-psikologi)",
  Ekonomi: "var(--color-topic-ekonomi)",
};

/** Tiga varian garis bawah amber organik (didefinisikan di globals.css). */
const UNDERLINE_VARIANTS = [
  "underline-amber-1",
  "underline-amber-2",
  "underline-amber-3",
] as const;

/**
 * Pilih varian garis bawah berdasarkan id paper.
 *
 * Sengaja deterministik, bukan `Math.random()`: varian harus tetap sama untuk
 * paper yang sama di setiap render, kalau tidak garisnya akan berkedip ganti
 * bentuk tiap kali komponen re-render. Yang penting variasinya tidak seragam
 * antar kartu (checklist anti-AI-slop), bukan acak sungguhan.
 */
export function underlineVariant(paperId: string): string {
  let hash = 0;
  for (let i = 0; i < paperId.length; i++) {
    hash = (hash * 31 + paperId.charCodeAt(i)) >>> 0;
  }
  return UNDERLINE_VARIANTS[hash % UNDERLINE_VARIANTS.length]!;
}

/** Format meta kartu: "6 mnt · Nature · 2024". */
export function formatCardMeta(params: {
  readingMinutes: number;
  venue: string | null;
  year: number | null;
}): string {
  return [
    `${params.readingMinutes} mnt`,
    params.venue,
    params.year ? String(params.year) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Format penulis: "Krizhevsky dkk." — nama belakang penulis pertama saja. */
export function formatAuthors(authors: string[]): string | null {
  if (authors.length === 0) return null;
  const lastName = authors[0]!.trim().split(/\s+/).pop() ?? authors[0]!;
  return authors.length > 1 ? `${lastName} dkk.` : lastName;
}

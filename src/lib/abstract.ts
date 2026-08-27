/**
 * OpenAlex mengembalikan abstrak sebagai inverted index (kata → daftar posisi),
 * bukan teks biasa. Konversi ini wajib sebelum abstrak bisa dipakai
 * (SPEC.md Bagian 6).
 */
export type InvertedIndex = Record<string, number[]>;

/**
 * Rekonstruksi teks abstrak dari inverted index OpenAlex.
 * Mengembalikan string kosong kalau input tidak valid/kosong.
 */
export function abstractFromInverted(inv: InvertedIndex | null | undefined): string {
  if (!inv || typeof inv !== "object") return "";

  const positions: Array<[number, string]> = [];
  for (const word in inv) {
    const indices = inv[word];
    if (!Array.isArray(indices)) continue;
    for (const idx of indices) {
      if (typeof idx === "number" && Number.isFinite(idx)) {
        positions.push([idx, word]);
      }
    }
  }

  if (positions.length === 0) return "";

  positions.sort((a, b) => a[0] - b[0]);
  return positions.map((p) => p[1]).join(" ");
}

/** Rata-rata kecepatan baca teks non-fiksi, dipakai untuk estimasi di kartu. */
const WORDS_PER_MINUTE = 200;

/**
 * Estimasi waktu baca dalam menit, minimum 1. Dihitung server-side supaya
 * angkanya sudah ada saat kartu pertama kali render — tidak ada layout shift
 * saat summary menyusul (Standar Kualitas: CLS < 0.1).
 */
export function estimateReadingMinutes(text: string): number {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

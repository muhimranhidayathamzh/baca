/**
 * Re-ranking "seimbang" (SPEC.md Bagian 6):
 *
 *   score = 0.6 * recency_normalized + 0.4 * log_citations_normalized
 *
 * Tujuannya menyeimbangkan paper baru (yang belum sempat dapat sitasi) dengan
 * paper mapan. Tanpa ini, feed hanya berisi paper lama bersitasi tinggi.
 */

const RECENCY_WEIGHT = 0.6;
const CITATION_WEIGHT = 0.4;

export interface RankableItem {
  year: number | null;
  citations: number;
}

/**
 * Urutkan ulang berdasarkan skor seimbang. Tidak memutasi array masukan.
 *
 * Normalisasi dilakukan relatif terhadap batch ini sendiri (min/max di dalam
 * batch), sesuai rumus di SPEC. Kalau seluruh batch punya tahun yang sama,
 * komponen recency-nya seragam sehingga urutan ditentukan sitasi saja.
 */
export function rerankBalanced<T extends RankableItem>(items: T[]): T[] {
  if (items.length <= 1) return [...items];

  const years = items.map((i) => i.year).filter((y): y is number => typeof y === "number");
  const minYear = years.length ? Math.min(...years) : 0;
  const maxYear = years.length ? Math.max(...years) : 0;
  const yearSpan = maxYear - minYear;

  const maxCites = Math.max(...items.map((i) => Math.max(0, i.citations)));
  const logMaxCites = Math.log(1 + maxCites);

  return [...items]
    .map((item, index) => {
      // Paper tanpa tahun diperlakukan paling lama — jangan diuntungkan.
      const recency =
        yearSpan > 0 && typeof item.year === "number"
          ? (item.year - minYear) / yearSpan
          : 0;

      const citations =
        logMaxCites > 0 ? Math.log(1 + Math.max(0, item.citations)) / logMaxCites : 0;

      return {
        item,
        // index dipakai sebagai tie-breaker stabil: kalau skor sama persis,
        // urutan asli dari OpenAlex dipertahankan.
        index,
        score: RECENCY_WEIGHT * recency + CITATION_WEIGHT * citations,
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

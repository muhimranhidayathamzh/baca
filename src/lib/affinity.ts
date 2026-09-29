import type { Paper, TopicName } from "@/types";

/**
 * Personalisasi feed "Untukmu" — sepenuhnya di perangkat, tanpa akun.
 *
 * Skor topik = jumlah paper yang dibuka + 3 × jumlah yang disimpan. Menyimpan
 * dihitung lebih berat karena itu sinyal minat yang jauh lebih kuat daripada
 * sekadar mengetuk.
 *
 * Bobot = 1 + skor/10, dibatasi maksimum 4. Dua batas itu disengaja:
 * - Minimum 1: topik yang jarang dibuka tetap muncul. Tanpanya feed menyempit
 *   ke satu topik dan user tidak pernah lagi menemukan hal di luar kebiasaannya.
 * - Maksimum 4: topik favorit paling banyak mendapat 4× porsi topik lain.
 */
const SAVE_WEIGHT = 3;
const SCORE_PER_STEP = 10;
const MAX_WEIGHT = 4;

export type Affinity = Partial<Record<TopicName, number>>;

export function topicScores(topics: TopicName[], affinity: Affinity, saved: Paper[]) {
  const scores = new Map<TopicName, number>(topics.map((t) => [t, affinity[t] ?? 0]));
  for (const paper of saved) {
    if (paper.topic && scores.has(paper.topic)) {
      scores.set(paper.topic, scores.get(paper.topic)! + SAVE_WEIGHT);
    }
  }
  return scores;
}

export function topicWeights(
  topics: TopicName[],
  affinity: Affinity,
  saved: Paper[],
): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const [topic, score] of topicScores(topics, affinity, saved)) {
    weights[topic] = Math.min(1 + score / SCORE_PER_STEP, MAX_WEIGHT);
  }
  return weights;
}

/**
 * Topik yang paling mendominasi feed "Untukmu", untuk dijelaskan di Profil.
 * `null` kalau belum ada topik yang cukup menonjol untuk disebut.
 */
export function leadingTopic(
  topics: TopicName[],
  affinity: Affinity,
  saved: Paper[],
): TopicName | null {
  const ranked = [...topicScores(topics, affinity, saved)].sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  if (!first || first[1] < 5) return null;
  if (second && first[1] < second[1] * 1.5) return null;
  return first[0];
}

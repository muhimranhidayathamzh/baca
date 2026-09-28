import "server-only";
import { KEY_PREFIX, dayKey, getRedis, isoWeekKey } from "./redis";

/**
 * Metrik anonim untuk dua pertanyaan di SPEC.md Bagian 9 langkah 29:
 *   1. Berapa persen user yang benar-benar membuka paper aslinya?
 *   2. Berapa paper yang dibaca per user per minggu?
 *
 * Menggantikan custom event Vercel Analytics, yang tidak tersedia di plan
 * Hobby. Disimpan di Upstash yang sudah ada — tanpa layanan baru.
 *
 * Privasi: "user" di sini hanyalah ID acak yang dibuat browser dan disimpan di
 * localStorage (terhapus oleh tombol Reset). Tidak ada IP, user agent, atau
 * paper apa yang dibaca siapa. Perangkat unik dihitung dengan HyperLogLog, yang
 * hanya menyimpan perkiraan jumlah — ID aslinya tidak bisa dibaca kembali.
 */

export const METRIC_EVENTS = ["paper_opened", "original_paper_opened"] as const;
export type MetricEvent = (typeof METRIC_EVENTS)[number];

export function isMetricEvent(value: unknown): value is MetricEvent {
  return typeof value === "string" && (METRIC_EVENTS as readonly string[]).includes(value);
}

/** Kunci dibiarkan hidup 120 hari — cukup untuk membandingkan beberapa bulan. */
const TTL_SECONDS = 60 * 60 * 24 * 120;

const countKey = (event: MetricEvent, day: string) => `${KEY_PREFIX}:m:count:${event}:${day}`;
const weekCountKey = (event: MetricEvent, week: string) => `${KEY_PREFIX}:m:wcount:${event}:${week}`;
const devicesKey = (event: MetricEvent, week: string) => `${KEY_PREFIX}:m:devices:${event}:${week}`;

export async function recordMetric(event: MetricEvent, deviceId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const day = dayKey();
  const week = isoWeekKey();

  // Satu pipeline = satu round-trip HTTP ke Upstash.
  const pipe = redis.pipeline();
  pipe.incr(countKey(event, day));
  pipe.expire(countKey(event, day), TTL_SECONDS);
  pipe.incr(weekCountKey(event, week));
  pipe.expire(weekCountKey(event, week), TTL_SECONDS);
  pipe.pfadd(devicesKey(event, week), deviceId);
  pipe.expire(devicesKey(event, week), TTL_SECONDS);
  await pipe.exec();
}

export interface WeeklyMetrics {
  week: string;
  /** Jumlah reader dibuka minggu itu. */
  papersOpened: number;
  /** Jumlah klik "Buka paper asli". */
  originalOpened: number;
  /** Perangkat unik yang membuka minimal satu paper. */
  readers: number;
  /** Perangkat unik yang membuka minimal satu paper asli. */
  originalOpeners: number;
  /** Metrik 1: persen pembaca yang sampai ke paper asli. */
  percentReachingOriginal: number | null;
  /** Metrik 2: rata-rata paper dibaca per pembaca. */
  papersPerReader: number | null;
}

/** Minggu ISO untuk `weeksBack` minggu terakhir, terbaru dulu. */
function recentWeeks(weeksBack: number): string[] {
  const weeks: string[] = [];
  for (let i = 0; i < weeksBack; i++) {
    weeks.push(isoWeekKey(new Date(Date.now() - i * 7 * 86_400_000)));
  }
  return weeks;
}

export async function readWeeklyMetrics(weeksBack = 4): Promise<WeeklyMetrics[] | null> {
  const redis = getRedis();
  if (!redis) return null;

  const weeks = recentWeeks(weeksBack);
  const pipe = redis.pipeline();
  for (const week of weeks) {
    pipe.get(weekCountKey("paper_opened", week));
    pipe.get(weekCountKey("original_paper_opened", week));
    pipe.pfcount(devicesKey("paper_opened", week));
    pipe.pfcount(devicesKey("original_paper_opened", week));
  }
  const raw = (await pipe.exec()) as unknown[];

  return weeks.map((week, i) => {
    const num = (v: unknown) => Number(v ?? 0) || 0;
    const papersOpened = num(raw[i * 4]);
    const originalOpened = num(raw[i * 4 + 1]);
    const readers = num(raw[i * 4 + 2]);
    const originalOpeners = num(raw[i * 4 + 3]);
    return {
      week,
      papersOpened,
      originalOpened,
      readers,
      originalOpeners,
      percentReachingOriginal:
        readers > 0 ? Math.round((originalOpeners / readers) * 1000) / 10 : null,
      papersPerReader: readers > 0 ? Math.round((papersOpened / readers) * 10) / 10 : null,
    };
  });
}

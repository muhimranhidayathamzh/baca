import { buildFeedUrl } from "./feed-url";
import { STORAGE_KEYS } from "./storage-keys";
import { TOPICS } from "./topics";

/**
 * Preload /api/feed sedini mungkin — dipasang di root layout sebagai
 * <Script strategy="beforeInteractive">.
 *
 * Tanpa ini, feed baru memanggil API setelah seluruh JS selesai diunduh dan
 * React selesai hydrate — audit Lighthouse (throttling nyata) mengukur HTML
 * tiba di 0,7 s tapi /api/feed baru mulai di 3,0 s. Topik user ada di
 * localStorage, yang tidak bisa dibaca server, jadi skrip kecil ini membacanya
 * di browser saat HTML diparse dan langsung memulai request, paralel dengan
 * unduhan JS. Saat React siap, `fetch` di useFeed memakai respons yang sudah
 * menunggu alih-alih memulai dari nol.
 *
 * Jalan di dua kasus:
 * - `/feed` dibuka langsung.
 * - `/` oleh user yang sudah onboarding. Ini start_url PWA, dan splash-nya
 *   selalu mengalihkan ke /feed — jadi setiap kali app dibuka dari homescreen
 *   ikut diuntungkan.
 *
 * Logika pemilihan topik/mode di sini HARUS sama dengan feed/page.tsx. Kalau
 * menyimpang, akibatnya aman — preload terbuang dan feed tetap memanggil API
 * sendiri — hanya lebih lambat. URL-nya sendiri dirakit fungsi yang sama.
 *
 * Diserialisasi lewat toString(), jadi harus self-contained.
 */
function preloadFeed(
  build: typeof buildFeedUrl,
  keys: typeof STORAGE_KEYS,
  allTopics: string[],
): void {
  try {
    const storage = window.localStorage;
    const read = <T,>(key: string, fallback: T): T => {
      const raw = storage.getItem(key);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    };

    const path = window.location.pathname;
    const onboarded = read<unknown>(keys.onboarded, false) === true;
    if (path !== "/feed" && !(path === "/" && onboarded)) return;

    const saved = read<unknown>(keys.topics, []);
    const topics = Array.isArray(saved) && saved.length > 0 ? (saved as string[]) : allTopics;
    const active = read<string | null>(keys.activeTopic, null);
    const topic = active && topics.includes(active) ? active : topics[0]!;
    const mode = read<string>(keys.mode, "fokus");
    const history = read<unknown>(keys.readHistory, []);

    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "fetch";
    // Wajib untuk preload `as=fetch`: tanpa atribut ini mode kredensialnya
    // tidak cocok dengan fetch() biasa dan respons tidak akan dipakai ulang.
    link.crossOrigin = "anonymous";
    link.href = build(topic, mode, Array.isArray(history) ? (history as string[]) : [], null, null);
    document.head.appendChild(link);
  } catch {
    // localStorage diblokir — feed tetap memuat seperti biasa setelah hydrate.
  }
}

export const FEED_PRELOAD_SCRIPT = `(${preloadFeed.toString()})(${buildFeedUrl.toString()},${JSON.stringify(
  STORAGE_KEYS,
)},${JSON.stringify(TOPICS)});`;

/**
 * URL /api/feed — dipakai `useFeed` DAN skrip preload inline (lib/feed-preload.ts).
 *
 * Satu sumber ini penting: browser hanya memakai ulang respons yang di-preload
 * kalau URL-nya identik sampai urutan parameter. Kalau keduanya dirakit
 * terpisah dan suatu hari menyimpang, preload diam-diam terbuang dan feed
 * memanggil API dua kali.
 *
 * Riwayat baca sengaja TIDAK ikut di URL: tanpanya URL sama untuk semua orang
 * dan bisa dilayani CDN, dan riwayat baca tidak pernah meninggalkan perangkat.
 *
 * WAJIB self-contained — tanpa import, tanpa variabel dari luar fungsi — karena
 * fungsi ini diserialisasi lewat `toString()` ke dalam skrip inline.
 */
export function buildFeedUrl(
  topic: string | null,
  mode: string,
  cursor: string | null,
  seed: number | null,
): string {
  const params = new URLSearchParams();
  if (topic) params.set("topic", topic);
  params.set("mode", mode);
  if (cursor) params.set("cursor", cursor);
  if (seed !== null) params.set("seed", String(seed));
  return "/api/feed?" + params.toString();
}

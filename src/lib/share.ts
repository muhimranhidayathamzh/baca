/**
 * Membagikan paper (SPEC.md Bagian 4.8): pakai Web Share API kalau ada,
 * kalau tidak salin tautannya ke clipboard.
 *
 * Dikumpulkan di sini karena dipakai kartu feed dan reading view — dan karena
 * pembedaan "dibatalkan" vs "gagal" di bawah gampang salah kalau ditulis dua kali.
 */
export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

export async function sharePaper(title: string, url: string): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (error) {
      // AbortError = user menutup sheet share sendiri. Itu keputusan sadar,
      // jadi jangan diganggu notifikasi apa pun.
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
      // Selain itu share benar-benar gagal (izin ditolak, browser bilang
      // punya API-nya tapi tidak bisa dipakai). Jangan diam — lanjut ke
      // clipboard supaya user tetap mendapat tautannya.
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Pesan toast untuk tiap hasil. `null` berarti sengaja tanpa notifikasi. */
export function shareToastMessage(outcome: ShareOutcome): string | null {
  switch (outcome) {
    case "copied":
      return "Tautan disalin";
    case "failed":
      return "Gagal membagikan tautan";
    default:
      // "shared" sudah jelas hasilnya di UI sistem; "cancelled" disengaja user.
      return null;
  }
}

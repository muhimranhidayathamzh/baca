/**
 * Sudahkah user berinteraksi (scroll, ketuk, tombol) sejak halaman dimuat?
 *
 * Dipakai untuk animasi coretan pulpen di kartu feed (components/ui/HookText).
 * Animasi itu menganimasikan `background-size`, yang memaksa teks hook
 * di-repaint saat sudah terlihat — dan Chrome lalu menghitung hook itu sebagai
 * Largest Contentful Paint. Terverifikasi Lighthouse: LCP /feed bergeser dari
 * judul (3,4 s) ke hook yang datang belakangan (5,0 s), padahal yang dilihat
 * user tidak lebih lambat. Chrome berhenti mengukur LCP begitu user
 * berinteraksi, jadi hook yang tiba SESUDAH itu bebas digoreskan — dan itu
 * memang momen yang pas: kartu baru terisi saat user sedang menggulir.
 */
let interacted = false;

if (typeof window !== "undefined") {
  const mark = () => {
    interacted = true;
    for (const type of EVENTS) window.removeEventListener(type, mark, true);
  };
  const EVENTS = ["scroll", "pointerdown", "keydown", "wheel", "touchstart"] as const;
  for (const type of EVENTS) {
    window.addEventListener(type, mark, { capture: true, passive: true });
  }
}

export function hasInteracted(): boolean {
  return interacted;
}

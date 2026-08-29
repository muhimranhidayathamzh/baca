"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Status koneksi browser.
 *
 * Saat render di server selalu dianggap online — menampilkan peringatan
 * offline di HTML yang dikirim server jelas salah, karena server tidak tahu
 * apa-apa soal koneksi si pengunjung.
 *
 * Catatan: `navigator.onLine` hanya tahu ada tidaknya antarmuka jaringan, bukan
 * apakah internetnya benar-benar jalan. Karena itu banner ini melengkapi
 * penanganan error per-request, bukan menggantikannya.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

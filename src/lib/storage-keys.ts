/**
 * Kunci localStorage (SPEC.md Bagian 2). Dikumpulkan di satu tempat supaya
 * tidak ada typo string yang tersebar di banyak file.
 *
 * Sengaja di modul netral (bukan di hooks/useLocalStorage.ts yang bertanda
 * "use client"): skrip preload feed dirakit di server component, dan server
 * component tidak bisa membaca nilai konstanta dari modul client — yang
 * didapat hanya referensi, bukan objeknya.
 */
export const STORAGE_KEYS = {
  onboarded: "baca_onboarded",
  topics: "baca_topics",
  mode: "baca_mode",
  saved: "baca_saved",
  readHistory: "baca_read_history",
  /**
   * Chip yang sedang aktif di feed: nama topik, atau "Untukmu" (campuran semua
   * topik). Tidak ada di daftar awal SPEC — ditambahkan supaya pilihan chip
   * user bertahan saat pindah halaman dan kembali lagi.
   */
  activeTopic: "baca_active_topic",
  /**
   * Berapa kali user membuka paper per topik, mis. {"AI": 12}. Menentukan
   * porsi tiap topik di feed "Untukmu" (lib/affinity.ts). Hanya di perangkat.
   */
  affinity: "baca_affinity",
  /**
   * ID perangkat acak untuk metrik anonim (lib/analytics.ts). Ada di sini
   * supaya tombol Reset ikut menghapusnya.
   */
  device: "baca_device",
} as const;

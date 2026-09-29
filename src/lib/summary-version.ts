/**
 * Versi prompt ringkasan. Naikkan setiap kali prompt di lib/summarize.ts
 * berubah dengan cara yang memengaruhi hasil.
 *
 * Dipakai di dua sisi: kunci cache Redis (server) dan parameter `v` di URL
 * /api/summarize (browser). Parameter URL itulah yang membuat CDN tidak terus
 * menyajikan ringkasan versi lama selama 30 hari setelah prompt diperbaiki.
 */
export const SUMMARY_VERSION = 3;

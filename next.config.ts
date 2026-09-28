import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// @serwist/next mem-bundle service worker lewat webpack plugin, belum
// dukung Turbopack (default `next dev`/`next build` di Next.js 16). Solusi
// resmi dari Serwist: nonaktifkan SW di dev (Turbopack tetap dipakai, cepat
// seperti biasa — SW memang kurang berguna saat dev), dan jalankan
// `next build --webpack` khusus untuk build produksi (lihat package.json)
// supaya plugin webpack Serwist benar-benar jalan membungkus sw.ts.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // withSerwistInit selalu menempel fungsi `webpack()` ke config (dicek
  // kondisinya baru saat runtime lewat `disable`), tapi Turbopack di Next 16
  // menolak start begitu melihat ADA `webpack()` custom, sebelum sempat tahu
  // isinya no-op. `turbopack: {}` eksplisit menghilangkan pengecekan itu.
  turbopack: {},

  experimental: {
    // CSS disisipkan langsung di <head>, bukan <link> terpisah yang memblokir
    // render. Audit Lighthouse mengukur dua file CSS ini menunda render ~950 ms
    // di jaringan mobile. Aman karena seluruh CSS app hanya ~8 KB (Tailwind
    // hanya menghasilkan class yang dipakai). Trade-off-nya: CSS tidak di-cache
    // terpisah — tapi HTML-nya sendiri sudah di-cache service worker PWA.
    inlineCss: true,
  },
};

export default withSerwist(nextConfig);

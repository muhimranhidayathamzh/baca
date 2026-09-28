# baca.

Platform baca jurnal/paper akademis bergaya feed — bukan search seperti Google
Scholar, tapi feed yang mendatangkan paper relevan seperti FYP TikTok/Instagram.
Interface dan ringkasan dalam Bahasa Indonesia.

Spesifikasi produk & teknis lengkap ada di [`docs/SPEC.md`](./docs/SPEC.md) —
dokumen itu adalah sumber kebenaran untuk semua keputusan di proyek ini.

## Stack

Next.js 16 (App Router) · Tailwind CSS v4 · Framer Motion · Upstash Redis ·
Gemini API · OpenAlex API · Vercel

## Setup

### 1. Clone & install
```bash
git clone <repo-url>
cd baca
npm install
```

### 2. Environment variables
Salin `.env.example` menjadi `.env.local`, lalu isi tiap key. Cara dapetin
masing-masing key ada di `docs/SPEC.md` Bagian 8.

```bash
cp .env.example .env.local
```

Untuk dev lokal, semua key boleh kosong dulu: feed dan search tetap jalan
(OpenAlex tanpa key, rate limit in-memory), hanya ringkasan AI yang jatuh ke
fallback sampai `GEMINI_API_KEY` diisi. Di produksi, kredensial Upstash **wajib**
— tanpanya semua API route sengaja membalas 429 (lihat `docs/SPEC.md` Bagian 11).

### 3. Jalankan dev server
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000).

## Struktur proyek

```
baca/
├── README.md          ← file ini
├── CLAUDE.md           ← instruksi kerja untuk Claude Code
├── .env.example        ← template environment variables
├── docs/
│   └── SPEC.md         ← spesifikasi lengkap (sumber kebenaran)
└── src/                ← source code (lihat docs/SPEC.md Bagian 7 untuk struktur detail)
```

## Deploy

Project ini dikonfigurasi untuk deploy ke Vercel. Hubungkan repo GitHub ke Vercel,
isi environment variables yang sama seperti `.env.local`, lalu deploy. Build
command biarkan default — `npm run build` sudah memakai `--webpack`, yang wajib
supaya service worker PWA ter-bundle. Checklist lengkap ada di `docs/SPEC.md`
Bagian 11.

> **Catatan lisensi:** Vercel Hobby plan ditujukan untuk penggunaan non-komersial.
> Kalau proyek ini mulai dipublikasikan secara komersial, pertimbangkan upgrade
> ke Vercel Pro.

## Status

MVP dalam pengembangan aktif. Urutan build dan fase ada di `docs/SPEC.md` Bagian 9.

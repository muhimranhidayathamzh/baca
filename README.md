# baca.

Platform baca jurnal/paper akademis bergaya feed — bukan search seperti Google
Scholar, tapi feed yang mendatangkan paper relevan seperti FYP TikTok/Instagram.
Interface dan ringkasan dalam Bahasa Indonesia.

Spesifikasi produk & teknis lengkap ada di [`docs/SPEC.md`](./docs/SPEC.md) —
dokumen itu adalah sumber kebenaran untuk semua keputusan di proyek ini.

## Stack

Next.js 14 (App Router) · Tailwind CSS · Framer Motion · Supabase · Gemini API ·
OpenAlex API · Vercel

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

### 3. Setup Supabase
Jalankan SQL schema dari `docs/SPEC.md` Bagian 2 (Database Schema) di SQL Editor
project Supabase kamu.

### 4. Jalankan dev server
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
isi environment variables yang sama seperti `.env.local`, lalu deploy.

> **Catatan lisensi:** Vercel Hobby plan ditujukan untuk penggunaan non-komersial.
> Kalau proyek ini mulai dipublikasikan secara komersial, pertimbangkan upgrade
> ke Vercel Pro.

## Status

MVP dalam pengembangan aktif. Urutan build dan fase ada di `docs/SPEC.md` Bagian 9.

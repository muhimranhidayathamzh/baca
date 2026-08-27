# Instruksi untuk Claude Code — Proyek "baca."

## Sumber kebenaran
**`docs/SPEC.md` adalah sumber kebenaran tunggal untuk seluruh keputusan produk,
desain, dan teknis.** Baca file itu di awal SETIAP sesi sebelum menulis kode apa pun.
Jangan asumsikan detail (warna, endpoint, schema, dll) dari memori sesi sebelumnya —
selalu verifikasi ulang ke SPEC.md karena dokumen itu adalah versi final yang berlaku.

## Aturan kerja

1. **Ikuti urutan Fase di Bagian 9 SPEC.md secara berurutan.** Jangan lompat ke fase
   berikutnya sebelum fase sebelumnya selesai dan berfungsi. Kalau ragu fase mana yang
   sedang dikerjakan, tanya dulu.

2. **Jangan mengubah keputusan arsitektur di SPEC.md tanpa konfirmasi eksplisit.**
   Stack, skema database, kontrak API, dan identitas visual sudah melalui proses
   review — bukan draft. Kalau menemukan alasan teknis kuat untuk menyimpang
   (misal: filter OpenAlex ternyata berubah), berhenti dan jelaskan trade-off-nya
   sebelum melanjutkan, jangan diam-diam mengganti pendekatan.

3. **Patuhi Standar Kualitas di Bagian 2 SPEC.md** sebagai syarat lulus, bukan
   aspirasi: Lighthouse Performance >90, transisi 60fps, FCP <1.5s, CLS <0.1.
   Kalau sebuah implementasi tidak memenuhi ini, perbaiki sebelum lanjut ke fitur
   berikutnya — jangan tumpuk technical debt di fondasi.

4. **Keamanan endpoint adalah non-negotiable.** `/api/summarize` HANYA menerima
   `paper_id`, tidak pernah abstrak mentah dari client (lihat Bagian 2 SPEC.md
   soal kenapa). Semua API routes wajib pakai rate limiting dari `lib/ratelimit.ts`
   sebelum dianggap selesai.

5. **Identitas visual "Meja Baca Saat Senja" harus dijaga konsisten** (Bagian 3
   SPEC.md) — termasuk checklist anti-AI-slop di dalamnya. Kalau menambah komponen
   UI baru yang tidak ada di spec, turunkan gaya dari token warna/tipografi yang
   sudah ada, jangan improvisasi palet baru.

6. **Setelah menyelesaikan sebuah Fase, laporkan ringkas:** apa yang selesai, apa
   yang menyimpang dari spec (jika ada) dan kenapa, dan apa yang perlu diverifikasi
   manual oleh pemilik proyek (misal: cek API key sudah benar, cek tampilan di
   browser asli).

7. **Kalau SPEC.md perlu diupdate** karena keputusan baru diambil selama build,
   update file itu langsung — jangan biarkan dokumentasi basi sementara kode
   berubah.

## Referensi cepat
- Spesifikasi lengkap: `docs/SPEC.md`
- Environment variables: lihat `.env.example` di root, isi sesuai `docs/SPEC.md` Bagian 8
- Prototype visual acuan (HTML, di luar repo ini, untuk referensi look & feel):
  `baca-visual-senja.html` dan `baca-app.html`

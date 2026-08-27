import { redirect } from "next/navigation";

/**
 * SPEC.md Bagian 7: root mengarahkan ke /feed kalau sudah onboarding, ke
 * /onboarding kalau belum. Pengecekan `baca_onboarded` baru bisa dipasang
 * setelah halaman onboarding dibuat di Fase 4 — sampai saat itu, semua
 * pengunjung langsung diarahkan ke feed.
 */
export default function Home() {
  redirect("/feed");
}

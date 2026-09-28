"use client";

import { LazyMotion, MotionConfig } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import BottomNav from "./BottomNav";
import OfflineBanner from "./OfflineBanner";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Rute yang tampil tanpa chrome aplikasi: splash dan onboarding. Keduanya
 * layar utuh sebelum user "masuk" ke app — memunculkan bottom nav di sana
 * berarti menawarkan navigasi ke halaman yang belum punya konteks.
 */
const CHROMELESS_ROUTES = new Set(["/", "/onboarding"]);

/**
 * Mesin animasi diunduh setelah halaman tampil (lihat lib/motion-features.ts).
 * Audit Lighthouse menemukan chunk Framer Motion penuh memakan ~520 ms waktu
 * boot di CPU mobile — penyebab utama skor Performance di bawah 90.
 */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

/**
 * Frame aplikasi persisten: bg meja gelap, noise grain overlay, banner offline,
 * bottom nav, dan host toast. TopBar dipasang per-halaman (lihat TopBar.tsx),
 * bukan di sini, karena judul/aksinya beda tiap halaman.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const chromeless = CHROMELESS_ROUTES.has(pathname);

  return (
    // `strict` membuat build melempar error kalau ada yang memakai `motion.`
    // (versi penuh) alih-alih `m.` — mencegah bundle besar diam-diam kembali.
    <LazyMotion features={loadMotionFeatures} strict>
      {/* Hormati setelan "kurangi gerakan" di sistem operasi user. */}
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <div className="relative flex min-h-dvh flex-col bg-desk text-on-d">
            <div className="noise-overlay" aria-hidden="true" />

            {!chromeless && <OfflineBanner />}

            {/*
              Landmark <main> untuk pembaca layar (audit Lighthouse: halaman
              feed/search/saved/profile tidak punya). Splash dan onboarding
              sudah membawa <main> sendiri, jadi di sana cukup <div> supaya
              tidak ada <main> bersarang. Padding bawah hanya saat ada nav.
            */}
            {chromeless ? (
              <div className="flex flex-1 flex-col">{children}</div>
            ) : (
              <main className="flex flex-1 flex-col pb-20">{children}</main>
            )}

            {!chromeless && <BottomNav />}
          </div>
        </ToastProvider>
      </MotionConfig>
    </LazyMotion>
  );
}

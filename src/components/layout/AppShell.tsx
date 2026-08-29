"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import BottomNav from "./BottomNav";

/**
 * Rute yang tampil tanpa chrome aplikasi: splash dan onboarding. Keduanya
 * layar utuh sebelum user "masuk" ke app — memunculkan bottom nav di sana
 * berarti menawarkan navigasi ke halaman yang belum punya konteks.
 */
const CHROMELESS_ROUTES = new Set(["/", "/onboarding"]);

/**
 * Frame aplikasi persisten: bg meja gelap, noise grain overlay, dan
 * bottom nav. TopBar dipasang per-halaman (lihat TopBar.tsx), bukan di sini,
 * karena judul/aksinya beda tiap halaman.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const chromeless = CHROMELESS_ROUTES.has(pathname);

  return (
    <div className="relative flex min-h-dvh flex-col bg-desk text-on-d">
      <div className="noise-overlay" aria-hidden="true" />
      {/* Padding bawah hanya saat ada nav yang perlu dihindari. */}
      <div className={chromeless ? "flex flex-1 flex-col" : "flex-1 pb-20"}>{children}</div>
      {!chromeless && <BottomNav />}
    </div>
  );
}

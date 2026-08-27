import type { ReactNode } from "react";
import BottomNav from "./BottomNav";

/**
 * Frame aplikasi persisten: bg meja gelap, noise grain overlay, dan
 * bottom nav yang selalu tampil. TopBar dipasang per-halaman (lihat
 * TopBar.tsx), bukan di sini, karena judul/aksinya beda tiap halaman.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-desk text-on-d">
      <div className="noise-overlay" aria-hidden="true" />
      <div className="flex-1 pb-20">{children}</div>
      <BottomNav />
    </div>
  );
}

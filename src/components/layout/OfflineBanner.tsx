"use client";

import { AnimatePresence, m } from "framer-motion";
import { WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Pemberitahuan saat koneksi putus (SPEC.md Bagian 9 langkah 26).
 *
 * Menawarkan jalan keluar, bukan cuma kabar buruk: paper yang di-bookmark
 * tersimpan di localStorage dan tetap bisa dibaca penuh tanpa internet.
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const pathname = usePathname();

  // Di halaman Saved tautannya tidak berguna — user sudah di sana.
  const showSavedLink = pathname !== "/saved";

  return (
    <AnimatePresence>
      {!isOnline && (
        <m.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="overflow-hidden border-b border-desk-line bg-desk-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 px-4 py-2.5">
            <WifiOff size={15} strokeWidth={1.75} className="shrink-0 text-on-d2" />
            <span className="min-w-0 flex-1 font-ui text-[12.5px] leading-snug text-on-d2">
              Kamu sedang offline.
              {showSavedLink && " Paper tersimpan tetap bisa dibaca."}
            </span>
            {showSavedLink && (
              <Link
                href="/saved"
                className="shrink-0 font-ui text-[12.5px] font-medium text-amber"
              >
                Buka
              </Link>
            )}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

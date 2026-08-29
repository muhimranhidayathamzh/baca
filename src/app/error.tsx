"use client";

import { RotateCw } from "lucide-react";
import { useEffect } from "react";

/**
 * Jaring pengaman untuk error render yang tidak tertangani (SPEC.md langkah 26).
 *
 * Pesan error aslinya sengaja tidak ditampilkan ke user — isinya sering jejak
 * teknis yang tidak berguna baginya dan bisa membocorkan detail internal.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Unhandled error:", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <p className="max-w-[18rem] font-serif-read text-[16px] leading-relaxed text-on-d2">
        Ada yang tidak beres di sisi kami.
      </p>
      <p className="mt-2 max-w-[18rem] font-ui text-[13px] leading-relaxed text-on-d3">
        Coba muat ulang. Kalau terus terjadi, tutup dan buka lagi aplikasinya.
      </p>

      <button
        type="button"
        onClick={reset}
        className="mt-7 flex items-center gap-2 rounded-full border border-desk-line px-4 py-2.5 font-ui text-[13.5px] text-on-d"
      >
        <RotateCw size={15} strokeWidth={1.75} />
        Coba lagi
      </button>
    </main>
  );
}

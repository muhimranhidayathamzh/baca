"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import PaperList from "@/components/feed/PaperList";
import TopBar from "@/components/layout/TopBar";
import { useIsHydrated } from "@/hooks/useLocalStorage";
import { useSavedPapers } from "@/hooks/usePaperCollections";

/**
 * Paper yang di-bookmark (SPEC.md Bagian 4.5). Datanya murni dari localStorage
 * — objek Paper disimpan utuh saat di-bookmark, jadi halaman ini tidak perlu
 * memanggil OpenAlex sama sekali.
 */
export default function SavedPage() {
  const { saved } = useSavedPapers();
  const hydrated = useIsHydrated();

  return (
    <>
      <TopBar
        title="Tersimpan"
        trailing={
          hydrated && saved.length > 0 ? (
            <span className="font-ui text-[12.5px] text-on-d3">
              {saved.length} paper
            </span>
          ) : null
        }
      />

      <div className="px-4 pt-3">
        {/* Sebelum localStorage terbaca, jangan tampilkan empty state — kalau
            tidak, user dengan bookmark akan melihat "kosong" sekilas dulu. */}
        {!hydrated ? null : (
          <PaperList
            papers={saved}
            empty={
              <div className="flex flex-col items-center px-6 py-20 text-center">
                <Bookmark size={26} strokeWidth={1.5} className="mb-4 text-on-d3" />
                <p className="max-w-[17rem] font-serif-read text-[15px] leading-relaxed text-on-d2">
                  Belum ada yang disimpan.
                </p>
                <p className="mt-2 max-w-[17rem] font-ui text-[13px] leading-relaxed text-on-d3">
                  Tap ikon bookmark di kartu mana pun buat menyimpannya ke sini.
                </p>
                <Link
                  href="/feed"
                  className="mt-6 rounded-full border border-desk-line px-4 py-2 font-ui text-[13px] text-on-d"
                >
                  Jelajahi feed
                </Link>
              </div>
            }
          />
        )}
      </div>
    </>
  );
}

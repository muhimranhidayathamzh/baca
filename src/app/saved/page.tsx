"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import PaperList from "@/components/feed/PaperList";
import TopBar from "@/components/layout/TopBar";
import EmptyState from "@/components/ui/EmptyState";
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
              <EmptyState
                icon={Bookmark}
                title="Belum ada yang disimpan."
                hint="Tap ikon bookmark di kartu mana pun buat menyimpannya ke sini — bisa dibaca lagi walau sedang offline."
                action={
                  <Link
                    href="/feed"
                    className="rounded-full border border-desk-line px-4 py-2 font-ui text-[13px] text-on-d"
                  >
                    Jelajahi feed
                  </Link>
                }
              />
            }
          />
        )}
      </div>
    </>
  );
}

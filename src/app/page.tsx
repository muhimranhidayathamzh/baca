"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { STORAGE_KEYS, useIsHydrated, useLocalStorage } from "@/hooks/useLocalStorage";

/**
 * Gerbang masuk (SPEC.md Bagian 7): ke /feed kalau sudah onboarding, ke
 * /onboarding kalau belum.
 *
 * Keputusannya harus diambil di browser karena `baca_onboarded` ada di
 * localStorage, yang tidak bisa dibaca server. Supaya jeda sepersekian detik
 * itu terbaca sebagai splash yang disengaja dan bukan kedipan, layar ini
 * memakai latar meja gelap yang sama dengan app dan menampilkan logonya.
 */
export default function Home() {
  const router = useRouter();
  const hydrated = useIsHydrated();
  const { value: onboarded } = useLocalStorage<boolean>(STORAGE_KEYS.onboarded, false);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(onboarded ? "/feed" : "/onboarding");
  }, [hydrated, onboarded, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      {/* CSS murni, bukan Framer Motion: logo ini elemen LCP layar splash dan
          tidak boleh menunggu JS dimuat dulu sebelum terlihat. */}
      <h1 className="enter-fade-up font-grotesk text-[40px] font-medium tracking-[-0.03em] text-on-d">
        baca<span className="text-amber">.</span>
      </h1>
    </main>
  );
}

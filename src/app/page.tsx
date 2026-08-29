"use client";

import { motion } from "framer-motion";
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
      <motion.h1
        className="font-grotesk text-[40px] font-medium tracking-[-0.03em] text-on-d"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        baca<span className="text-amber">.</span>
      </motion.h1>
    </main>
  );
}

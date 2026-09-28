"use client";

import { AnimatePresence, m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import TopicPicker from "@/components/onboarding/TopicPicker";
import { STORAGE_KEYS, useLocalStorage } from "@/hooks/useLocalStorage";
import type { TopicName } from "@/types";

/** Minimum topik yang harus dipilih (SPEC.md Bagian 4.1). */
const MIN_TOPICS = 3;

const SPRING = { type: "spring", damping: 25, stiffness: 300 } as const;

const EMPTY_TOPICS: TopicName[] = [];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [picked, setPicked] = useState<TopicName[]>([]);

  const { setValue: setTopics } = useLocalStorage<TopicName[]>(
    STORAGE_KEYS.topics,
    EMPTY_TOPICS,
  );
  const { setValue: setOnboarded } = useLocalStorage<boolean>(STORAGE_KEYS.onboarded, false);
  const { setValue: setActiveTopic } = useLocalStorage<TopicName | null>(
    STORAGE_KEYS.activeTopic,
    null,
  );

  function toggle(topic: TopicName) {
    setPicked((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  }

  function finish() {
    if (picked.length < MIN_TOPICS) return;
    setTopics(picked);
    // Topik pertama yang dipilih jadi default di feed (SPEC.md Bagian 4.1).
    setActiveTopic(picked[0]!);
    setOnboarded(true);
    router.replace("/feed");
  }

  const remaining = MIN_TOPICS - picked.length;

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden px-6 pb-8 pt-16">
      {/*
        Pendar lampu baca hangat naik dari bawah — bahasa visual yang sama
        dengan ikon app di homescreen, jadi layar pertama terasa menyambung
        dengan ikon yang baru saja diketuk. Statis, tanpa JS.
      */}
      {step === 0 && <div className="lamp-glow" aria-hidden="true" />}

      <AnimatePresence mode="wait" initial={false}>
        {step === 0 ? (
          /*
            Layar Welcome sengaja TIDAK memakai animasi masuk berbasis JS.
            Tagline adalah elemen LCP halaman ini; Framer Motion me-render
            `opacity: 0` di HTML server, sehingga teks baru tampil setelah JS
            dimuat dan di-hydrate — audit Lighthouse mengukurnya LCP 3,3 s.
            Animasi masuknya kini CSS murni (globals.css) yang jalan sejak
            paint pertama, dan tagline tidak pernah disembunyikan.
          */
          <m.div
            key="welcome"
            className="relative flex flex-1 flex-col"
            exit={{ opacity: 0, y: -12 }}
            transition={SPRING}
          >
            <div className="flex flex-1 flex-col justify-center">
              <h1 className="enter-fade-up font-grotesk text-[44px] font-medium leading-none tracking-[-0.03em] text-on-d">
                baca<span className="text-amber">.</span>
              </h1>

              <p className="mt-5 max-w-[19rem] font-serif-read text-[19px] leading-[1.5] text-on-d2">
                Riset terbaru, ditulis ulang dalam{" "}
                {/*
                  Garis bawah signature digambar masuk seperti coretan pulpen.
                  Ini perkenalan bahasa visualnya: saat user melihat hook
                  pertama di feed, coretan ini sudah terasa familiar.
                */}
                <span className="underline-amber-2 underline-draw text-on-d">
                  bahasa yang kamu ngerti
                </span>
                .
              </p>
            </div>

            <m.button
              type="button"
              onClick={() => setStep(1)}
              whileTap={{ scale: 0.985 }}
              transition={SPRING}
              className="enter-fade-up enter-delay-2 w-full rounded-[14px] bg-amber py-3.5 font-ui text-[15px] font-medium text-desk"
            >
              Mulai
            </m.button>
          </m.div>
        ) : (
          <m.div
            key="topics"
            className="flex flex-1 flex-col"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={SPRING}
          >
            <h2 className="font-grotesk text-[26px] font-medium leading-tight tracking-[-0.02em] text-on-d">
              Apa yang bikin kamu penasaran?
            </h2>
            <p className="mt-2 font-ui text-[13.5px] leading-relaxed text-on-d2">
              Pilih minimal {MIN_TOPICS} topik. Bisa diubah kapan saja di profil.
            </p>

            <div className="mt-7">
              <TopicPicker selected={picked} onToggle={toggle} />
            </div>

            <div className="flex-1" />

            {/*
              Hitungan hidup, bukan tombol mati tanpa penjelasan — user tahu
              persis apa yang kurang.
            */}
            <p className="mb-3 text-center font-ui text-[12.5px] text-on-d3">
              {remaining > 0
                ? `Pilih ${remaining} topik lagi`
                : `${picked.length} topik dipilih`}
            </p>

            <m.button
              type="button"
              onClick={finish}
              disabled={picked.length < MIN_TOPICS}
              whileTap={picked.length >= MIN_TOPICS ? { scale: 0.985 } : undefined}
              animate={{ opacity: picked.length >= MIN_TOPICS ? 1 : 0.4 }}
              transition={SPRING}
              className="w-full rounded-[14px] bg-amber py-3.5 font-ui text-[15px] font-medium text-desk disabled:cursor-not-allowed"
            >
              Masuk ke feed
            </m.button>
          </m.div>
        )}
      </AnimatePresence>
    </main>
  );
}

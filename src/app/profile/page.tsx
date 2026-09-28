"use client";

import { AnimatePresence, m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import TopicPicker from "@/components/onboarding/TopicPicker";
import TopBar from "@/components/layout/TopBar";
import {
  STORAGE_KEYS,
  clearAllStorage,
  useIsHydrated,
  useLocalStorage,
} from "@/hooks/useLocalStorage";
import { useReadHistory, useSavedPapers } from "@/hooks/usePaperCollections";
import { TOPICS, TOPIC_DOT_COLOR } from "@/lib/topics";
import type { TopicName } from "@/types";

const MIN_TOPICS = 3;
const APP_VERSION = "0.1.0";
const SPRING = { type: "spring", damping: 25, stiffness: 300 } as const;

const EMPTY_TOPICS: TopicName[] = [];

export default function ProfilePage() {
  const router = useRouter();
  const hydrated = useIsHydrated();

  const { value: topics, setValue: setTopics } = useLocalStorage<TopicName[]>(
    STORAGE_KEYS.topics,
    EMPTY_TOPICS,
  );
  const { saved } = useSavedPapers();
  const { history } = useReadHistory();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TopicName[]>([]);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const current = topics.length > 0 ? topics : TOPICS;

  function startEditing() {
    setDraft(current);
    setEditing(true);
  }

  function toggleDraft(topic: TopicName) {
    setDraft((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  }

  function saveTopics() {
    if (draft.length < MIN_TOPICS) return;
    // Feed membaca kunci yang sama lewat useSyncExternalStore, jadi chip bar
    // dan isinya ikut ter-update sendiri tanpa perlu diberi tahu (SPEC.md 4.9).
    setTopics(draft);
    setEditing(false);
  }

  function resetEverything() {
    clearAllStorage();
    router.replace("/onboarding");
  }

  const remaining = MIN_TOPICS - draft.length;

  return (
    <>
      <TopBar title="Profil" />

      <div className="px-6 pt-6">
        {/*
          Statistik ditulis sebagai kalimat, bukan deretan kartu angka besar.
          Tiga kotak metrik raksasa adalah pola dashboard generik — di meja
          baca senja, satu kalimat lirih jauh lebih pas.
        */}
        <p className="font-serif-read text-[17px] leading-[1.65] text-on-d2">
          {hydrated ? (
            history.length === 0 && saved.length === 0 ? (
              <>Belum ada yang dibaca. Feed-nya nunggu kamu.</>
            ) : (
              <>
                Kamu sudah membuka{" "}
                <span className="font-medium text-on-d">{history.length} paper</span>
                {saved.length > 0 ? (
                  <>
                    {" "}
                    dan menyimpan{" "}
                    <span className="font-medium text-on-d">{saved.length}</span> di
                    antaranya.
                  </>
                ) : (
                  <>.</>
                )}
              </>
            )
          ) : (
            <span className="inline-block h-5 w-56 animate-pulse rounded bg-desk-3" />
          )}
        </p>

        <section className="mt-9">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-ui text-[11.5px] font-semibold uppercase tracking-[0.06em] text-on-d3">
              Topik kamu
            </h2>
            {!editing && (
              <button
                type="button"
                onClick={startEditing}
                className="font-ui text-[13px] text-amber"
              >
                Ubah
              </button>
            )}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {editing ? (
              <m.div
                key="editor"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={SPRING}
                className="mt-4"
              >
                <TopicPicker selected={draft} onToggle={toggleDraft} />

                <div className="mt-4 flex items-center gap-3">
                  <m.button
                    type="button"
                    onClick={saveTopics}
                    disabled={draft.length < MIN_TOPICS}
                    whileTap={draft.length >= MIN_TOPICS ? { scale: 0.985 } : undefined}
                    animate={{ opacity: draft.length >= MIN_TOPICS ? 1 : 0.4 }}
                    transition={SPRING}
                    className="rounded-full bg-amber px-5 py-2 font-ui text-[13.5px] font-medium text-desk disabled:cursor-not-allowed"
                  >
                    Simpan
                  </m.button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="font-ui text-[13.5px] text-on-d2"
                  >
                    Batal
                  </button>
                  {remaining > 0 && (
                    <span className="ml-auto font-ui text-[12px] text-on-d3">
                      Pilih {remaining} lagi
                    </span>
                  )}
                </div>
              </m.div>
            ) : (
              <m.ul
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3.5 flex flex-wrap gap-2"
              >
                {current.map((topic) => (
                  <li
                    key={topic}
                    className="flex items-center gap-1.5 rounded-full border border-desk-line px-3 py-1.5 font-ui text-[13px] text-on-d2"
                  >
                    <span
                      className="size-[6px] rounded-full"
                      style={{ backgroundColor: TOPIC_DOT_COLOR[topic] }}
                      aria-hidden="true"
                    />
                    {topic}
                  </li>
                ))}
              </m.ul>
            )}
          </AnimatePresence>
        </section>

        <section className="mt-10 border-t border-desk-line pt-6">
          <h2 className="font-ui text-[11.5px] font-semibold uppercase tracking-[0.06em] text-on-d3">
            Data lokal
          </h2>
          {/*
            Klaim lama "tidak pernah dikirim ke mana pun" tidak akurat: riwayat
            baca ikut terkirim ke /api/feed (sebagai `exclude`, supaya paper
            yang sudah dibaca tidak muncul lagi), dan ada penghitung metrik
            anonim. Kalimat ini hanya menjanjikan yang memang benar.
          */}
          <p className="mt-2 font-ui text-[13px] leading-relaxed text-on-d3">
            Bookmark, riwayat, dan preferensi kamu disimpan di browser ini — tidak
            ada akun, dan server kami tidak menyimpan apa yang kamu baca. Kami
            hanya menghitung angka anonim, seperti berapa paper yang dibuka.
          </p>

          {/* Reset tidak bisa dibatalkan, jadi butuh dua langkah. */}
          <AnimatePresence mode="wait" initial={false}>
            {confirmingReset ? (
              <m.div
                key="confirm"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={SPRING}
                className="mt-4 rounded-card border border-desk-line bg-desk-2 p-4"
              >
                <p className="font-ui text-[13.5px] leading-relaxed text-on-d">
                  Hapus semua data lokal? Bookmark dan riwayat kamu hilang, dan
                  kamu akan mulai lagi dari onboarding.
                </p>
                <div className="mt-3.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={resetEverything}
                    className="rounded-full bg-[#8E3B32] px-4 py-2 font-ui text-[13px] font-medium text-on-d"
                  >
                    Ya, hapus semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(false)}
                    className="font-ui text-[13px] text-on-d2"
                  >
                    Batal
                  </button>
                </div>
              </m.div>
            ) : (
              <m.button
                key="trigger"
                type="button"
                onClick={() => setConfirmingReset(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-4 rounded-full border border-desk-line px-4 py-2 font-ui text-[13px] text-on-d2"
              >
                Reset semua data
              </m.button>
            )}
          </AnimatePresence>
        </section>

        <p className="mt-10 pb-4 font-ui text-[11.5px] text-on-d3">
          baca. v{APP_VERSION} · data paper dari OpenAlex
        </p>
      </div>
    </>
  );
}

"use client";

import { m } from "framer-motion";
import { TOPICS, TOPIC_DOT_COLOR } from "@/lib/topics";
import type { TopicName } from "@/types";

/**
 * Petunjuk singkat tiap topik. "Neurosains" dan "Psikologi" terdengar mirip
 * buat orang yang bukan peneliti — satu baris pembeda menghemat tebak-tebakan.
 */
const TOPIC_HINT: Record<TopicName, string> = {
  Kesehatan: "Klinis, penyakit, gizi",
  AI: "Model, data, komputasi",
  Neurosains: "Otak, saraf, memori",
  Lingkungan: "Iklim, ekosistem, energi",
  Psikologi: "Perilaku, emosi, kognisi",
  Ekonomi: "Pasar, kebijakan, perilaku ekonomi",
};

const SPRING = { type: "spring", damping: 25, stiffness: 300 } as const;

export default function TopicPicker({
  selected,
  onToggle,
}: {
  selected: TopicName[];
  onToggle: (topic: TopicName) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {TOPICS.map((topic) => {
        const isOn = selected.includes(topic);
        return (
          <button
            key={topic}
            type="button"
            onClick={() => onToggle(topic)}
            aria-pressed={isOn}
            className={`relative overflow-hidden rounded-card border p-3.5 text-left transition-colors ${
              isOn
                ? "border-amber/60 bg-amber-lo"
                : "border-desk-line bg-desk-2 hover:border-desk-3"
            }`}
          >
            {/*
              Titik topik adalah penanda pilihan — membesar dan berpendar saat
              dipilih. Bahasa visualnya sama dengan titik di kartu feed, jadi
              user sudah mengenalinya sebelum melihat kartu pertama.
            */}
            <m.span
              className="mb-2.5 block rounded-full"
              style={{ backgroundColor: TOPIC_DOT_COLOR[topic] }}
              animate={{
                width: isOn ? 14 : 8,
                height: isOn ? 14 : 8,
                boxShadow: isOn
                  ? `0 0 12px ${TOPIC_DOT_COLOR[topic]}`
                  : "0 0 0px rgba(0,0,0,0)",
              }}
              transition={SPRING}
              aria-hidden="true"
            />

            <span
              className={`block font-grotesk text-[15px] font-medium ${
                isOn ? "text-on-d" : "text-on-d2"
              }`}
            >
              {topic}
            </span>
            <span className="mt-0.5 block font-ui text-[11.5px] leading-snug text-on-d3">
              {TOPIC_HINT[topic]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

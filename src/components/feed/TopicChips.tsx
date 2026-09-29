"use client";

import { FOR_YOU, TOPIC_DOT_COLOR, type FeedChip } from "@/lib/topics";
import type { TopicName } from "@/types";

interface TopicChipsProps {
  topics: TopicName[];
  active: FeedChip;
  onChange: (chip: FeedChip) => void;
}

const CHIP_BASE =
  "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-ui text-[13px] transition-colors";
const CHIP_ACTIVE = "border-amber bg-amber-lo text-on-d";
const CHIP_IDLE = "border-desk-line text-on-d2 hover:border-desk-3";

/**
 * Penanda chip "Untukmu": titik-titik warna topik yang dicampur, saling
 * menumpuk. Tidak memakai ikon "sparkle" khas fitur AI (checklist
 * anti-AI-slop) — penandanya menjelaskan isinya sendiri: beberapa topik jadi satu.
 */
function BlendDots({ topics }: { topics: TopicName[] }) {
  return (
    <span className="flex shrink-0 items-center" aria-hidden="true">
      {topics.slice(0, 3).map((topic, index) => (
        <span
          key={topic}
          className="size-[7px] rounded-full ring-[1.5px] ring-desk"
          style={{
            backgroundColor: TOPIC_DOT_COLOR[topic],
            marginLeft: index === 0 ? 0 : -2.5,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Filter feed (SPEC.md Bagian 4.2): "Untukmu" lalu satu chip per topik pilihan.
 * Scroll horizontal tanpa scrollbar terlihat.
 */
export default function TopicChips({ topics, active, onChange }: TopicChipsProps) {
  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-3 pt-3">
      <button
        type="button"
        onClick={() => onChange(FOR_YOU)}
        aria-pressed={active === FOR_YOU}
        className={`${CHIP_BASE} ${active === FOR_YOU ? CHIP_ACTIVE : CHIP_IDLE}`}
      >
        <BlendDots topics={topics} />
        {FOR_YOU}
      </button>

      {topics.map((topic) => (
        <button
          key={topic}
          type="button"
          onClick={() => onChange(topic)}
          aria-pressed={topic === active}
          className={`${CHIP_BASE} ${topic === active ? CHIP_ACTIVE : CHIP_IDLE}`}
        >
          <span
            className="size-[6px] shrink-0 rounded-full"
            style={{ backgroundColor: TOPIC_DOT_COLOR[topic] }}
            aria-hidden="true"
          />
          {topic}
        </button>
      ))}
    </div>
  );
}

"use client";

import { TOPIC_DOT_COLOR } from "@/lib/topics";
import type { TopicName } from "@/types";

interface TopicChipsProps {
  topics: TopicName[];
  active: TopicName | null;
  onChange: (topic: TopicName) => void;
}

/**
 * Filter topik berdasarkan pilihan onboarding (SPEC.md Bagian 4.2).
 * Scroll horizontal tanpa scrollbar terlihat.
 */
export default function TopicChips({ topics, active, onChange }: TopicChipsProps) {
  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-3 pt-3">
      {topics.map((topic) => {
        const isActive = topic === active;
        return (
          <button
            key={topic}
            type="button"
            onClick={() => onChange(topic)}
            aria-pressed={isActive}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-ui text-[13px] transition-colors ${
              isActive
                ? "border-amber bg-amber-lo text-on-d"
                : "border-desk-line text-on-d2 hover:border-desk-3"
            }`}
          >
            <span
              className="size-[6px] shrink-0 rounded-full"
              style={{ backgroundColor: TOPIC_DOT_COLOR[topic] }}
              aria-hidden="true"
            />
            {topic}
          </button>
        );
      })}
    </div>
  );
}

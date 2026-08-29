import type { ComponentType, ReactNode } from "react";

interface EmptyStateProps {
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /** Kalimat utama — ditulis serif, nada tenang, bukan seruan. */
  title: string;
  /** Penjelasan opsional: apa yang bisa dilakukan user berikutnya. */
  hint?: string;
  action?: ReactNode;
}

/**
 * Tampilan saat tidak ada yang bisa ditampilkan (SPEC.md Bagian 9 langkah 25).
 *
 * Dikumpulkan jadi satu komponen supaya nada dan spasinya seragam di feed,
 * search, dan saved — sebelumnya ketiganya ditulis terpisah dan mulai
 * menyimpang satu sama lain.
 */
export default function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      {Icon && <Icon size={26} strokeWidth={1.5} className="mb-4 text-on-d3" />}

      <p className="max-w-[17rem] font-serif-read text-[15px] leading-relaxed text-on-d2">
        {title}
      </p>

      {hint && (
        <p className="mt-2 max-w-[17rem] font-ui text-[13px] leading-relaxed text-on-d3">
          {hint}
        </p>
      )}

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

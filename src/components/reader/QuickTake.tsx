import { Zap } from "lucide-react";

/**
 * Quick take: 3 kalimat ringkas (SPEC.md Bagian 4.3).
 * Tampil di halaman terang, jadi warnanya memakai token page-*.
 */
export default function QuickTake({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-7">
      <h3 className="mb-3 flex items-center gap-1.5 font-ui text-[11.5px] font-semibold uppercase tracking-[0.06em] text-page-ink2">
        <Zap size={14} strokeWidth={2} className="text-amber" />
        Quick take
        <span className="font-normal normal-case tracking-normal text-page-ink2">
          · 30 detik
        </span>
      </h3>

      <ul className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li
            key={index}
            className="relative pl-5 font-serif-read text-[15px] leading-relaxed text-page-ink"
          >
            {/* Kotak kecil amber, bukan bullet bulat — konsisten dengan
                bahasa visual yang tajam, bukan bubbly. */}
            <span
              className="absolute left-0 top-[0.55em] size-[6px] rounded-[2px] bg-amber"
              aria-hidden="true"
            />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

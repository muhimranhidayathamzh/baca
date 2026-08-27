/**
 * Placeholder saat summary AI belum masuk (SPEC.md Bagian 4.2).
 *
 * Tingginya sengaja disamakan dengan tinggi konten aslinya supaya kartu tidak
 * meloncat saat shimmer diganti hook (Standar Kualitas: CLS < 0.1).
 */
export default function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-desk-3 ${className}`}
      aria-hidden="true"
    />
  );
}

/** Susunan shimmer untuk area hook di kartu feed: dua baris teks. */
export function HookShimmer() {
  return (
    <div className="flex flex-col gap-2 py-0.5">
      <Shimmer className="h-5 w-[92%]" />
      <Shimmer className="h-5 w-[65%]" />
    </div>
  );
}

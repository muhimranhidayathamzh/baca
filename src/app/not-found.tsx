import Link from "next/link";

/** Halaman 404 (SPEC.md langkah 26). */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-20 text-center">
      <p className="font-grotesk text-[32px] font-medium tracking-[-0.02em] text-on-d">
        404
      </p>
      <p className="mt-3 max-w-[18rem] font-serif-read text-[15px] leading-relaxed text-on-d2">
        Halaman ini tidak ada.
      </p>

      <Link
        href="/feed"
        className="mt-7 rounded-full border border-desk-line px-4 py-2.5 font-ui text-[13.5px] text-on-d"
      >
        Kembali ke feed
      </Link>
    </div>
  );
}

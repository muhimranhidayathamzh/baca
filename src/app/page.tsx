import TopBar from "@/components/layout/TopBar";

/**
 * Placeholder Fase 1. Logic redirect sesungguhnya (onboarded -> /feed,
 * belum -> /onboarding, SPEC.md Bagian 7) menyusul begitu kedua route
 * itu dibangun di Fase 3/4.
 */
export default function Home() {
  return (
    <>
      <TopBar title="baca." />
      <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
        <p className="font-grotesk text-3xl text-on-d">baca.</p>
        <p className="max-w-xs font-ui text-sm text-on-d2">
          Fondasi aplikasi sudah siap. Onboarding dan feed menyusul di fase
          berikutnya.
        </p>
      </div>
    </>
  );
}

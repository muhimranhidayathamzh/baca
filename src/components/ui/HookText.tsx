"use client";

import { useState } from "react";
import { hasInteracted } from "@/lib/first-interaction";
import { underlineVariant } from "@/lib/topics";

/**
 * Hook dengan garis bawah amber di frasa kunci — elemen signature app
 * (SPEC.md Bagian 3). Dipakai kartu feed DAN headline reader, supaya coretan
 * yang sama menyambung dari kartu ke halaman baca.
 *
 * `keyPhrase` dijamin substring persis dari hook oleh lib/summarize.ts, tapi
 * tetap dicek di sini — kalau tidak ketemu, hook ditampilkan polos. Garis bawah
 * di posisi salah lebih merusak daripada tidak ada garis bawah sama sekali.
 *
 * Varian coretan dipilih dari id paper, jadi kartu dan reader untuk paper yang
 * sama selalu memakai coretan yang identik.
 */
export default function HookText({
  hook,
  keyPhrase,
  paperId,
  draw,
}: {
  hook: string;
  keyPhrase: string | null;
  paperId: string;
  /**
   * Goreskan coretannya dari kiri ke kanan saat pertama tampil, seperti
   * pulpen. Animasinya CSS murni dan hanya berjalan sekali saat elemen dipasang.
   * - "always": reader — selalu dibuka lewat ketukan.
   * - "after-interaction": kartu feed — hanya kalau hook tiba setelah user
   *   mulai berinteraksi (alasannya di lib/first-interaction.ts).
   */
  draw?: "always" | "after-interaction";
}) {
  // Diputuskan sekali saat hook dipasang: kalau ikut berubah saat user
  // pertama menggulir, hook yang sudah tampil akan menggores ulang.
  const [animate] = useState(
    () => draw === "always" || (draw === "after-interaction" && hasInteracted()),
  );

  if (!keyPhrase) return <>{hook}</>;

  const index = hook.indexOf(keyPhrase);
  if (index === -1) return <>{hook}</>;

  return (
    <>
      {hook.slice(0, index)}
      <span className={`${underlineVariant(paperId)}${animate ? " underline-draw-quick" : ""}`}>
        {keyPhrase}
      </span>
      {hook.slice(index + keyPhrase.length)}
    </>
  );
}

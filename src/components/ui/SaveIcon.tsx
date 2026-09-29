"use client";

import { Bookmark } from "lucide-react";
import { useState } from "react";

/**
 * Ikon bookmark dengan animasi "cap" saat paper BARU SAJA disimpan.
 *
 * Kartu yang dipasang dalam keadaan sudah tersimpan tidak ikut beranimasi —
 * yang dirayakan adalah aksinya, bukan statusnya. Transisi false → true
 * dideteksi dengan pola "sesuaikan state saat render" dari dokumentasi React,
 * dan `key` yang berganti memasang ulang elemennya supaya animasi CSS diputar
 * lagi setiap kali disimpan.
 */
export default function SaveIcon({ saved, size }: { saved: boolean; size: number }) {
  const [previous, setPrevious] = useState(saved);
  const [stamps, setStamps] = useState(0);

  if (saved !== previous) {
    setPrevious(saved);
    if (saved) setStamps((n) => n + 1);
  }

  return (
    <span key={stamps} className={`block ${saved && stamps > 0 ? "stamp" : ""}`}>
      <Bookmark size={size} strokeWidth={1.75} className={saved ? "fill-amber text-amber" : ""} />
    </span>
  );
}

"use client";

import { AnimatePresence, m } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Berapa lama toast bertahan sebelum menghilang sendiri. */
const DURATION_MS = 2000;

interface ToastValue {
  /** Tampilkan pesan singkat. Pesan baru menggantikan yang sedang tampil. */
  show: (message: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

interface ToastState {
  /** Naik tiap kali show() dipanggil, supaya pesan yang sama bisa tampil ulang. */
  id: number;
  message: string;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: string) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message }));
  }, []);

  // Timer di-reset tiap pesan baru, jadi toast beruntun tidak saling memotong.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/*
        Duduk di atas bottom nav (z-50) tapi di bawah reader (z-70/80) — toast
        dari dalam reader tetap terlihat karena reader tidak menutupi area ini
        sepenuhnya, sementara toast tidak pernah menghalangi gestur tutup.
      */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[88px] z-[65] flex justify-center px-6"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence>
          {toast && (
            <m.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="max-w-full truncate rounded-full border border-desk-line bg-desk-3 px-4 py-2.5 font-ui text-[13px] text-on-d shadow-lg"
            >
              {toast.message}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Umpan balik singkat untuk aksi yang hasilnya tidak langsung terlihat
 * (SPEC.md Bagian 4.8).
 *
 * Aman dipanggil di luar provider — mengembalikan no-op alih-alih melempar,
 * supaya komponen tetap bisa dipakai terpisah (mis. saat diuji sendirian).
 */
export function useToast(): ToastValue {
  const context = useContext(ToastContext);
  return context ?? { show: () => {} };
}

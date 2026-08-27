"use client";

import { useCallback, useState } from "react";
import type { Paper } from "@/types";

/**
 * State overlay reading view. Dipisah dari komponen supaya feed, search, dan
 * saved (Fase 4) bisa memakai reader yang sama.
 */
export function useReader(onOpened?: (paper: Paper) => void) {
  const [activePaper, setActivePaper] = useState<Paper | null>(null);

  const open = useCallback(
    (paper: Paper) => {
      setActivePaper(paper);
      onOpened?.(paper);
    },
    [onOpened],
  );

  const close = useCallback(() => setActivePaper(null), []);

  return { activePaper, open, close } as const;
}

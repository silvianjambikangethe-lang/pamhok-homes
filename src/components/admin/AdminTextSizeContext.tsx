"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type TextScale = 1 | 1.25 | 1.5;

const STORAGE_KEY = "pamhok-admin-text-scale";

const AdminTextSizeContext = createContext<{
  scale: TextScale;
  setScale: (scale: TextScale) => void;
} | null>(null);

export function AdminTextSizeProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScaleState] = useState<TextScale>(1);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    if (stored === 1 || stored === 1.25 || stored === 1.5) {
      setScaleState(stored);
    }
  }, []);

  function setScale(next: TextScale) {
    setScaleState(next);
    window.localStorage.setItem(STORAGE_KEY, String(next));
  }

  return (
    <AdminTextSizeContext.Provider value={{ scale, setScale }}>
      {/* `zoom` (not transform: scale) so layout actually reflows at the
          larger size — table rows, buttons, and spacing grow with the
          text instead of the text alone getting bigger inside
          unchanged-size boxes. Scoped to this wrapper only, so the
          guest-facing Header/Footer around the admin dashboard stay put. */}
      <div style={{ zoom: scale }}>{children}</div>
    </AdminTextSizeContext.Provider>
  );
}

export function useAdminTextSize() {
  const ctx = useContext(AdminTextSizeContext);
  if (!ctx) throw new Error("useAdminTextSize must be used within AdminTextSizeProvider");
  return ctx;
}

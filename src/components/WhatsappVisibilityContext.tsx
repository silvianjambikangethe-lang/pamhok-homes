"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const WhatsappVisibilityContext = createContext<{
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
} | null>(null);

export function WhatsappVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  return (
    <WhatsappVisibilityContext.Provider value={{ hidden, setHidden }}>
      {children}
    </WhatsappVisibilityContext.Provider>
  );
}

// Lets a specific page/step (e.g. the portal's payment-pending / ID
// verification step) hide the global WhatsApp button without the root
// layout needing to know about booking state.
export function useWhatsappVisibility() {
  const ctx = useContext(WhatsappVisibilityContext);
  if (!ctx) {
    throw new Error("useWhatsappVisibility must be used within WhatsappVisibilityProvider");
  }
  return ctx;
}

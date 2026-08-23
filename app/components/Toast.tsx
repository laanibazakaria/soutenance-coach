"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Variante = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variante: Variante;
}

interface ToastApi {
  show: (message: string, variante?: Variante, dureeMs?: number) => number;
  success: (message: string, dureeMs?: number) => number;
  error: (message: string, dureeMs?: number) => number;
  info: (message: string, dureeMs?: number) => number;
  dismiss: (id: number) => void;
}

const DUREE_PAR_DEFAUT_MS = 5000;
const ICONES: Record<Variante, string> = { success: "✓", error: "✕", info: "i" };

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Notifications non bloquantes, empilées (une vraie file : deux messages
 * rapprochés s'ajoutent au lieu de s'écraser), annoncées aux lecteurs
 * d'écran par aria-live. Remplace les bandeaux de texte et les alert().
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const suivant = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((courants) => courants.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variante: Variante = "info", dureeMs = DUREE_PAR_DEFAUT_MS) => {
      const id = ++suivant.current;
      setToasts((courants) => [...courants, { id, message, variante }]);
      if (dureeMs > 0) setTimeout(() => dismiss(id), dureeMs);
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, d) => show(m, "success", d),
      error: (m, d) => show(m, "error", d),
      info: (m, d) => show(m, "info", d),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`toast toast-${t.variante}`}>
            <span className="toast-icon" aria-hidden="true">
              {ICONES[t.variante]}
            </span>
            <span className="toast-texte">{t.message}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Fermer la notification">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() doit être appelé à l'intérieur de <ToastProvider>.");
  return ctx;
}

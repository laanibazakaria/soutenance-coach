import { SessionProvider } from "next-auth/react";
import AccountBar from "./components/AccountBar";
import Sidebar, { OngletsMobiles, Marque } from "./components/Sidebar";
import PageHero from "./components/PageHero";
import { ToastProvider } from "@/app/components/Toast";
import ErrorBoundary from "@/app/components/ErrorBoundary";

/**
 * Coquille de l'application : barre latérale (bureau) ou onglets (mobile),
 * barre supérieure avec l'état du compte, bandeau de tête par page, et un
 * filet de sécurité autour du contenu.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <div className="shell">
          <Sidebar />
          <div className="main">
            <header className="topbar">
              <div className="topbar-brand">
                <Marque taille={22} />
              </div>
              <span className="topbar-espace" aria-hidden="true" />
              <AccountBar />
            </header>
            <PageHero />
            <main className="content">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
            <OngletsMobiles />
          </div>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}

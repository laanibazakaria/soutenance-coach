import { SessionProvider } from "next-auth/react";
import Sidebar, { OngletsMobiles } from "./components/Sidebar";
import BarreHaut from "./components/BarreHaut";
import SyncCompte from "./components/SyncCompte";
import PageHero from "./components/PageHero";
import ModuleTabs from "./components/ModuleTabs";
import { ToastProvider } from "@/app/components/Toast";
import ErrorBoundary from "@/app/components/ErrorBoundary";

/**
 * Coquille de l'application : barre latérale (bureau) ou onglets (mobile),
 * barre du haut (recherche, forfait, cloche, avatar), bandeau de tête par
 * page, et un filet de sécurité autour du contenu.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <div className="shell">
          <a href="#contenu" className="skip-link">
            Aller au contenu
          </a>
          <Sidebar />
          <div className="main">
            <SyncCompte />
            <BarreHaut />
            <PageHero />
            <ModuleTabs />
            <main className="content" id="contenu" tabIndex={-1}>
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
            <OngletsMobiles />
          </div>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}

import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://soutenance-coach.vercel.app"),
  title: {
    default: "SoutenanceCoach — prépare ta soutenance, sérieusement",
    template: "%s · SoutenanceCoach",
  },
  description:
    "De « j'ai une date » à « je suis prêt » : un parcours jour par jour, tes slides, tes fiches, un coach, un jury. Mesures objectives, jamais de note inventée. Gratuit, compte facultatif.",
  keywords: ["soutenance", "PFA", "PFE", "oral", "entraînement", "ENSIAS", "prise de parole"],
  authors: [{ name: "Zakaria Laaniba", url: "https://laanibazakaria.github.io" }],
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "SoutenanceCoach", statusBarStyle: "default" },
  openGraph: {
    title: "SoutenanceCoach — prépare ta soutenance, sérieusement",
    description: "Un parcours jour par jour, tes slides, tes fiches, un coach, un jury. Gratuit, compte facultatif.",
    type: "website",
    locale: "fr_FR",
  },
};

export const viewport: Viewport = { themeColor: "#6f00ff", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}

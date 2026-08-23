import type { Metadata } from "next";
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
  openGraph: {
    title: "SoutenanceCoach — prépare ta soutenance, sérieusement",
    description: "Un parcours jour par jour, tes slides, tes fiches, un coach, un jury. Gratuit, compte facultatif.",
    type: "website",
    locale: "fr_FR",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}

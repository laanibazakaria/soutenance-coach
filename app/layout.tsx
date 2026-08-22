import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://soutenance-coach.vercel.app"),
  title: {
    default: "SoutenanceCoach — prépare ta soutenance, sérieusement",
    template: "%s · SoutenanceCoach",
  },
  description:
    "L'entraînement à l'oral qui se souvient. Transcription en direct, mesures objectives (débit, mots béquilles, structure, tenue du temps) et suivi de ta progression d'une séance à l'autre. Gratuit, sans compte, tes enregistrements restent sur ton appareil.",
  keywords: ["soutenance", "PFA", "PFE", "oral", "entraînement", "ENSIAS", "prise de parole"],
  authors: [{ name: "Zakaria Laaniba", url: "https://laanibazakaria.github.io" }],
  openGraph: {
    title: "SoutenanceCoach — prépare ta soutenance, sérieusement",
    description:
      "Transcription en direct, mesures objectives et suivi de ta progression. Gratuit, sans compte.",
    type: "website",
    locale: "fr_FR",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}

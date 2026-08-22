/**
 * Extraction du texte d'un PDF — la seule partie qui dépend du navigateur.
 * Isolée ici pour que `analyse.ts` et le jury restent testables sans DOM.
 *
 * Le fichier n'est jamais envoyé nulle part : PDF.js le lit en mémoire.
 */

import { decouperSlide } from "./analyse";
import type { Deck } from "./types";

/** Erreur lisible par l'utilisateur, distincte d'un plantage technique. */
export class ExtractionError extends Error {}

export async function extraireDeckPDF(file: File): Promise<Deck> {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new ExtractionError(
      "Seuls les PDF sont pris en charge pour l'instant. Exporte tes slides en PDF (PowerPoint : Fichier → Exporter → PDF).",
    );
  }

  const pdfjs = await import("pdfjs-dist");
  // Le worker est servi depuis le paquet installé, pas depuis un CDN : rien
  // ne sort du navigateur, y compris le code.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  let document;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    document = await pdfjs.getDocument({ data }).promise;
  } catch {
    throw new ExtractionError(
      "Ce PDF n'a pas pu être lu. S'il est protégé par un mot de passe, retire la protection et réessaie.",
    );
  }

  const slides = [];
  for (let numero = 1; numero <= document.numPages; numero++) {
    const page = await document.getPage(numero);
    const contenu = await page.getTextContent();
    // PDF.js renvoie des fragments : on reconstitue des lignes avec les
    // marqueurs de fin de ligne qu'il fournit.
    const texte = contenu.items
      .map((item) => {
        if (!("str" in item)) return "";
        return item.str + (item.hasEOL ? "\n" : " ");
      })
      .join("");
    slides.push(decouperSlide(numero, texte));
  }

  return { nomFichier: file.name, slides };
}
